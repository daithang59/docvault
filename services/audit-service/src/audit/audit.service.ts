import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { AuditEvent, AuditEventDocument } from '../mongo/audit-event.schema';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

const AUTHORIZED_CONTENT_ACTIONS = [
  'DOCUMENT_DOWNLOAD_AUTHORIZED',
  'DOCUMENT_PREVIEW_AUTHORIZED',
] as const;

export interface RiskyDocumentSummary {
  documentId: string;
  classification: string;
  accessCount: number;
  actorCount: number;
  latestAccessAt: string;
  riskScore: number;
  reasons: string[];
}

interface RiskBucket {
  documentId: string;
  classification: string;
  accessCount: number;
  actors: Set<string>;
  downloadCount: number;
  latestAccessAt: Date;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditEvent: Model<AuditEventDocument>,
  ) {}

  async create(dto: CreateAuditEventDto) {
    const eventId = dto.eventId ?? randomUUID();

    // 1. Get hash of the most recent event for chain linking
    const lastEvent = await this.auditEvent
      .findOne({}, { hash: 1 })
      .sort({ timestamp: -1 })
      .lean();

    const prevHash = lastEvent?.hash ?? null;

    // 2. Build canonical payload for deterministic hashing
    const canonicalFields: Record<string, any> = {
      eventId,
      timestamp: dto.timestamp,
      actorId: dto.actorId,
      actorRoles: dto.actorRoles,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      result: dto.result,
      reason: dto.reason,
      ip: dto.ip,
      traceId: dto.traceId,
    };
    const metadataStr = this.canonicalMetadata(dto.metadata);
    if (metadataStr !== undefined) {
      canonicalFields.metadata = metadataStr;
    }
    const canonicalPayload = this.buildCanonicalPayload(canonicalFields);

    const hash = this.computeHash(prevHash, canonicalPayload);

    // 3. Insert the event
    const saved = await this.auditEvent.create({
      eventId,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      actorId: dto.actorId,
      actorRoles: dto.actorRoles,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      result: dto.result,
      reason: dto.reason,
      ip: dto.ip,
      traceId: dto.traceId,
      metadata: dto.metadata,
      prevHash,
      hash,
    });

    return saved.toObject();
  }

  async query(dto: QueryAuditDto) {
    const filter: Record<string, any> = {};

    if (dto.actorId) filter.actorId = dto.actorId;
    if (dto.action) filter.action = dto.action;
    if (dto.resourceType) filter.resourceType = dto.resourceType;
    if (dto.resourceId) filter.resourceId = dto.resourceId;
    if (dto.result) filter.result = dto.result;
    if (dto.documentId) {
      const documentScope = {
        $or: [
          { resourceType: 'DOCUMENT', resourceId: dto.documentId },
          { 'metadata.docId': dto.documentId },
        ],
      };

      if (Object.keys(filter).length === 0) {
        Object.assign(filter, documentScope);
      } else {
        filter.$and = [documentScope];
      }
    }

    if (dto.from || dto.to) {
      filter.timestamp = {};
      if (dto.from) filter.timestamp.$gte = new Date(dto.from);
      if (dto.to) filter.timestamp.$lte = new Date(dto.to);
    }

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? dto.limit ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.auditEvent
        .find(filter, { _id: 0 })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      this.auditEvent.countDocuments(filter),
    ]);

    return { data, total, page, pageSize };
  }

  async securitySummary(): Promise<{
    chain: Awaited<ReturnType<AuditService['verifyChain']>>;
    totals: {
      deniedEvents: number;
      malwareBlocked: number;
      dlpDetections: number;
      downloadDenied: number;
    };
    repeatedDenyActors: Array<{ actorId: string; denyCount: number }>;
    riskyDocuments: RiskyDocumentSummary[];
  }> {
    const [
      chain,
      deniedEvents,
      malwareBlocked,
      dlpDetections,
      downloadDenied,
      repeatedDenyActors,
      riskyDocuments,
    ] = await Promise.all([
      this.verifyChain(1000),
      this.auditEvent.countDocuments({ result: 'DENY' }),
      this.auditEvent.countDocuments({ action: 'MALWARE_UPLOAD_BLOCKED' }),
      this.auditEvent.countDocuments({ action: 'DLP_PATTERN_DETECTED' }),
      this.auditEvent.countDocuments({ action: 'DOCUMENT_DOWNLOAD_DENIED' }),
      this.getRepeatedDenyActors(),
      this.getRiskyDocuments(),
    ]);

    return {
      chain,
      totals: {
        deniedEvents,
        malwareBlocked,
        dlpDetections,
        downloadDenied,
      },
      repeatedDenyActors,
      riskyDocuments,
    };
  }

  /**
   * Build a deterministic canonical string from audit event fields.
   * Fields are sorted alphabetically and serialized as key=value pairs.
   */
  private buildCanonicalPayload(fields: Record<string, any>): string {
    return Object.keys(fields)
      .sort()
      .map((key) => {
        const value = fields[key];
        if (value === undefined || value === null) return `${key}=`;
        if (Array.isArray(value)) return `${key}=${value.join(',')}`;
        return `${key}=${value}`;
      })
      .join('|');
  }

  /**
   * Normalize metadata for deterministic hashing:
   * both undefined and {} → null, so they produce identical hashes.
   */
  private canonicalMetadata(
    metadata: Record<string, unknown> | undefined,
  ): string | undefined {
    if (metadata === undefined || Object.keys(metadata).length === 0) {
      return undefined;
    }
    return JSON.stringify(metadata);
  }

  /**
   * Compute SHA-256 hash from prevHash + canonical payload.
   * hash = SHA-256(prevHash + "|" + canonicalPayload)
   */
  private computeHash(
    prevHash: string | null,
    canonicalPayload: string,
  ): string {
    const input = `${prevHash ?? ''}|${canonicalPayload}`;
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  private async getRepeatedDenyActors(): Promise<
    Array<{ actorId: string; denyCount: number }>
  > {
    const query = this.auditEvent.aggregate([
      { $match: { result: 'DENY', actorId: { $ne: null } } },
      { $group: { _id: '$actorId', denyCount: { $sum: 1 } } },
      { $match: { denyCount: { $gte: 3 } } },
      { $sort: { denyCount: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, actorId: '$_id', denyCount: 1 } },
    ]);

    if (typeof (query as any).exec === 'function') {
      return (query as any).exec();
    }

    return query as any;
  }

  private async getRiskyDocuments(): Promise<RiskyDocumentSummary[]> {
    const events = await this.auditEvent
      .find(
        {
          action: { $in: [...AUTHORIZED_CONTENT_ACTIONS] },
          result: 'SUCCESS',
        },
        {
          _id: 0,
          action: 1,
          actorId: 1,
          metadata: 1,
          resourceId: 1,
          resourceType: 1,
          timestamp: 1,
        },
      )
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    const buckets = new Map<string, RiskBucket>();

    for (const event of events as any[]) {
      const documentId = this.extractDocumentId(event);
      if (!documentId) continue;

      const classification = this.extractClassification(event.metadata);
      const timestamp = this.toEventDate(event.timestamp);
      const bucket = buckets.get(documentId) ?? {
        documentId,
        classification,
        accessCount: 0,
        actors: new Set<string>(),
        downloadCount: 0,
        latestAccessAt: timestamp,
      };

      bucket.accessCount += 1;
      if (typeof event.actorId === 'string' && event.actorId.length > 0) {
        bucket.actors.add(event.actorId);
      }
      if (event.action === 'DOCUMENT_DOWNLOAD_AUTHORIZED') {
        bucket.downloadCount += 1;
      }
      if (timestamp.getTime() > bucket.latestAccessAt.getTime()) {
        bucket.latestAccessAt = timestamp;
      }
      if (
        this.classificationWeight(classification) >
        this.classificationWeight(bucket.classification)
      ) {
        bucket.classification = classification;
      }

      buckets.set(documentId, bucket);
    }

    return Array.from(buckets.values())
      .map((bucket) => this.buildRiskyDocumentSummary(bucket))
      .filter((document) => document.riskScore > 0)
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        return (
          new Date(b.latestAccessAt).getTime() -
          new Date(a.latestAccessAt).getTime()
        );
      })
      .slice(0, 5);
  }

  private buildRiskyDocumentSummary(
    bucket: RiskBucket,
  ): RiskyDocumentSummary {
    const actorCount = bucket.actors.size;
    const riskScore = Math.min(
      100,
      this.classificationWeight(bucket.classification) +
        Math.min(bucket.accessCount * 8, 30) +
        Math.min(Math.max(actorCount - 1, 0) * 10, 20) +
        Math.min(bucket.downloadCount * 5, 15),
    );
    const reasons: string[] = [];

    if (this.classificationWeight(bucket.classification) > 0) {
      reasons.push(`${bucket.classification} classification`);
    }
    if (bucket.accessCount >= 2) {
      reasons.push(
        `${bucket.accessCount} successful preview/download grants`,
      );
    }
    if (actorCount >= 2) {
      reasons.push(`${actorCount} distinct actors`);
    }
    if (bucket.downloadCount > 0) {
      reasons.push(
        `${bucket.downloadCount} download grant${bucket.downloadCount === 1 ? '' : 's'}`,
      );
    }

    return {
      documentId: bucket.documentId,
      classification: bucket.classification,
      accessCount: bucket.accessCount,
      actorCount,
      latestAccessAt: bucket.latestAccessAt.toISOString(),
      riskScore,
      reasons,
    };
  }

  private extractDocumentId(event: {
    metadata?: Record<string, unknown>;
    resourceId?: unknown;
    resourceType?: unknown;
  }): string | undefined {
    const metadataDocId = event.metadata?.docId;
    if (typeof metadataDocId === 'string' && metadataDocId.length > 0) {
      return metadataDocId;
    }
    if (
      event.resourceType === 'DOCUMENT' &&
      typeof event.resourceId === 'string' &&
      event.resourceId.length > 0
    ) {
      return event.resourceId;
    }
    return undefined;
  }

  private extractClassification(metadata?: Record<string, unknown>): string {
    const classification = String(metadata?.classification ?? '').toUpperCase();
    if (
      classification === 'SECRET' ||
      classification === 'CONFIDENTIAL' ||
      classification === 'INTERNAL' ||
      classification === 'PUBLIC'
    ) {
      return classification;
    }
    return 'UNKNOWN';
  }

  private classificationWeight(classification: string): number {
    switch (classification) {
      case 'SECRET':
        return 45;
      case 'CONFIDENTIAL':
        return 30;
      case 'INTERNAL':
        return 10;
      default:
        return 0;
    }
  }

  private toEventDate(timestamp: unknown): Date {
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date(0);
  }

  /**
   * Verify the integrity of the hash chain from the first event up to `limit` events.
   * Returns { valid: true } if every hash links correctly; otherwise throws with details.
   */
  async verifyChain(limit = 1000): Promise<{ valid: boolean; checked: number; firstBrokenIndex?: number; message?: string }> {
    const events = await this.auditEvent
      .find({}, { _id: 0 })
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    if (events.length === 0) {
      return { valid: true, checked: 0 };
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i] as any;
      const canonicalPayload = this.buildCanonicalPayload({
        eventId: event.eventId,
        timestamp: event.timestamp?.toISOString?.() ?? event.timestamp,
        actorId: event.actorId,
        actorRoles: event.actorRoles,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        result: event.result,
        reason: event.reason,
        ip: event.ip,
        traceId: event.traceId,
        metadata: (event as any).metadata !== undefined
          ? JSON.stringify((event as any).metadata)
          : undefined,
      });
      const expectedHash = this.computeHash(
        i === 0 ? null : (events[i - 1] as any).hash,
        canonicalPayload,
      );

      if (event.hash !== expectedHash) {
        return {
          valid: false,
          checked: i + 1,
          firstBrokenIndex: i,
          message: `Hash mismatch at event index ${i} (eventId=${event.eventId}). Expected=${expectedHash}, got=${event.hash}`,
        };
      }

      if (event.prevHash !== (i === 0 ? null : (events[i - 1] as any).hash)) {
        return {
          valid: false,
          checked: i + 1,
          firstBrokenIndex: i,
          message: `prevHash mismatch at event index ${i} (eventId=${event.eventId}). Expected=${i === 0 ? null : (events[i - 1] as any).hash}, got=${event.prevHash}`,
        };
      }
    }

    return { valid: true, checked: events.length };
  }
}
