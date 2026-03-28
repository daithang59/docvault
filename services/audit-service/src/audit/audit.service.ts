import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { AuditEvent, AuditEventDocument } from '../mongo/audit-event.schema';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

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
