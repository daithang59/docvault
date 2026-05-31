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

const BEHAVIOR_SIGNAL_ACTIONS = [
  ...AUTHORIZED_CONTENT_ACTIONS,
  'DOCUMENT_DOWNLOAD_DENIED',
  'DOCUMENT_METADATA_READ_DENIED',
  'DOCUMENT_ACL_DELETED',
  'DOCUMENT_ARCHIVE',
  'DOCUMENT_AUTO_ARCHIVED',
  'DOCUMENT_METADATA_UPDATED',
  'DOCUMENT_UPLOADED',
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

export type BehaviorSignalType =
  | 'MASS_CONTENT_ACCESS'
  | 'DENY_BURST'
  | 'DESTRUCTIVE_ACTIVITY';

export type BehaviorSignalSeverity = 'critical' | 'warning' | 'watch';

export interface BehaviorSignalSummary {
  signalId: string;
  type: BehaviorSignalType;
  severity: BehaviorSignalSeverity;
  actorId: string;
  actionCount: number;
  documentCount: number;
  windowStartedAt: string;
  windowEndedAt: string;
  riskScore: number;
  reasons: string[];
}

export type SecurityRecommendationType =
  | 'AUDIT_CHAIN_REVIEW'
  | 'DLP_CLASSIFICATION_REVIEW'
  | 'MALWARE_UPLOAD_REVIEW'
  | 'DOCUMENT_ACCESS_REVIEW'
  | 'ACTOR_ACCESS_REVIEW';

export type SecurityRecommendationSeverity = 'critical' | 'warning' | 'info';

export interface SecurityRecommendationSummary {
  id: string;
  type: SecurityRecommendationType;
  severity: SecurityRecommendationSeverity;
  title: string;
  reason: string;
  recommendedAction: string;
  evidence: string[];
  affectedDocumentIds: string[];
  affectedActorIds: string[];
  auditFilters: {
    actorId?: string;
    action?: string;
    result?: string;
    resourceType?: string;
    resourceId?: string;
    documentId?: string;
  };
}

export interface SecuritySummaryViewer {
  actorId?: string;
  roles?: string[];
  ip?: string;
  traceId?: string;
}

interface RiskBucket {
  documentId: string;
  classification: string;
  accessCount: number;
  actors: Set<string>;
  downloadCount: number;
  latestAccessAt: Date;
}

interface BehaviorBucket {
  actorId: string;
  contentAccessCount: number;
  downloadCount: number;
  sensitiveAccessCount: number;
  denyCount: number;
  destructiveCount: number;
  contentDocuments: Set<string>;
  denyDocuments: Set<string>;
  destructiveDocuments: Set<string>;
  windowStartedAt: Date;
  windowEndedAt: Date;
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

  async securitySummary(viewer?: SecuritySummaryViewer): Promise<{
    chain: Awaited<ReturnType<AuditService['verifyChain']>>;
    totals: {
      deniedEvents: number;
      malwareBlocked: number;
      dlpDetections: number;
      downloadDenied: number;
    };
    repeatedDenyActors: Array<{ actorId: string; denyCount: number }>;
    riskyDocuments: RiskyDocumentSummary[];
    behaviorSignals: BehaviorSignalSummary[];
    recommendations: SecurityRecommendationSummary[];
  }> {
    const [
      chain,
      deniedEvents,
      malwareBlocked,
      dlpDetections,
      downloadDenied,
      repeatedDenyActors,
      riskyDocuments,
      behaviorSignals,
    ] = await Promise.all([
      this.verifyChain(1000),
      this.auditEvent.countDocuments({ result: 'DENY' }),
      this.auditEvent.countDocuments({ action: 'MALWARE_UPLOAD_BLOCKED' }),
      this.auditEvent.countDocuments({ action: 'DLP_PATTERN_DETECTED' }),
      this.auditEvent.countDocuments({ action: 'DOCUMENT_DOWNLOAD_DENIED' }),
      this.getRepeatedDenyActors(),
      this.getRiskyDocuments(),
      this.getBehaviorSignals(),
    ]);

    const summary = {
      chain,
      totals: {
        deniedEvents,
        malwareBlocked,
        dlpDetections,
        downloadDenied,
      },
      repeatedDenyActors,
      riskyDocuments,
      behaviorSignals,
      recommendations: this.buildSecurityRecommendations({
        chain,
        totals: {
          deniedEvents,
          malwareBlocked,
          dlpDetections,
          downloadDenied,
        },
        repeatedDenyActors,
        riskyDocuments,
        behaviorSignals,
      }),
    };

    await this.recordRecommendationView(viewer, summary.recommendations);

    return summary;
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

  private async getBehaviorSignals(): Promise<BehaviorSignalSummary[]> {
    const events = await this.auditEvent
      .find(
        {
          action: { $in: [...BEHAVIOR_SIGNAL_ACTIONS] },
        },
        {
          _id: 0,
          action: 1,
          actorId: 1,
          metadata: 1,
          resourceId: 1,
          resourceType: 1,
          result: 1,
          timestamp: 1,
        },
      )
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();

    const buckets = new Map<string, BehaviorBucket>();

    for (const event of events as any[]) {
      if (typeof event.actorId !== 'string' || event.actorId.length === 0) {
        continue;
      }

      const timestamp = this.toEventDate(event.timestamp);
      const bucket = buckets.get(event.actorId) ?? {
        actorId: event.actorId,
        contentAccessCount: 0,
        downloadCount: 0,
        sensitiveAccessCount: 0,
        denyCount: 0,
        destructiveCount: 0,
        contentDocuments: new Set<string>(),
        denyDocuments: new Set<string>(),
        destructiveDocuments: new Set<string>(),
        windowStartedAt: timestamp,
        windowEndedAt: timestamp,
      };
      const documentId = this.extractDocumentId(event);

      if (timestamp.getTime() < bucket.windowStartedAt.getTime()) {
        bucket.windowStartedAt = timestamp;
      }
      if (timestamp.getTime() > bucket.windowEndedAt.getTime()) {
        bucket.windowEndedAt = timestamp;
      }

      if ((AUTHORIZED_CONTENT_ACTIONS as readonly string[]).includes(event.action)) {
        bucket.contentAccessCount += 1;
        if (documentId) bucket.contentDocuments.add(documentId);
        if (event.action === 'DOCUMENT_DOWNLOAD_AUTHORIZED') {
          bucket.downloadCount += 1;
        }
        const classification = this.extractClassification(event.metadata);
        if (classification === 'SECRET' || classification === 'CONFIDENTIAL') {
          bucket.sensitiveAccessCount += 1;
        }
      }

      if (this.isDeniedSecurityEvent(event)) {
        bucket.denyCount += 1;
        if (documentId) bucket.denyDocuments.add(documentId);
      }

      if (this.isDestructiveAction(event.action)) {
        bucket.destructiveCount += 1;
        if (documentId) bucket.destructiveDocuments.add(documentId);
      }

      buckets.set(event.actorId, bucket);
    }

    return Array.from(buckets.values())
      .flatMap((bucket) => this.buildBehaviorSignals(bucket))
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        return (
          new Date(b.windowEndedAt).getTime() -
          new Date(a.windowEndedAt).getTime()
        );
      })
      .slice(0, 5);
  }

  private buildBehaviorSignals(bucket: BehaviorBucket): BehaviorSignalSummary[] {
    const signals: BehaviorSignalSummary[] = [];

    if (
      bucket.contentAccessCount >= 5 ||
      (bucket.contentAccessCount >= 3 && bucket.contentDocuments.size >= 5)
    ) {
      const riskScore = Math.min(
        100,
        30 +
          Math.min(bucket.contentAccessCount * 8, 40) +
          Math.min(bucket.contentDocuments.size * 6, 30) +
          Math.min(bucket.sensitiveAccessCount * 8, 24) +
          Math.min(bucket.downloadCount * 4, 12),
      );
      const reasons = [
        `${bucket.contentAccessCount} successful preview/download grants`,
        `${bucket.contentDocuments.size} distinct documents`,
      ];

      if (bucket.sensitiveAccessCount > 0) {
        reasons.push(`${bucket.sensitiveAccessCount} sensitive document grants`);
      }
      if (bucket.downloadCount > 0) {
        reasons.push(
          `${bucket.downloadCount} download grant${bucket.downloadCount === 1 ? '' : 's'}`,
        );
      }

      signals.push(
        this.createBehaviorSignal(
          'MASS_CONTENT_ACCESS',
          bucket.actorId,
          bucket.contentAccessCount,
          bucket.contentDocuments.size,
          bucket.windowStartedAt,
          bucket.windowEndedAt,
          riskScore,
          reasons,
        ),
      );
    }

    if (bucket.denyCount >= 3) {
      const riskScore = Math.min(
        100,
        25 + bucket.denyCount * 7 + bucket.denyDocuments.size * 4,
      );
      const reasons = [
        `${bucket.denyCount} denied security events`,
        `${bucket.denyDocuments.size} distinct documents`,
      ];

      signals.push(
        this.createBehaviorSignal(
          'DENY_BURST',
          bucket.actorId,
          bucket.denyCount,
          bucket.denyDocuments.size,
          bucket.windowStartedAt,
          bucket.windowEndedAt,
          riskScore,
          reasons,
        ),
      );
    }

    if (bucket.destructiveCount >= 2) {
      const riskScore = Math.min(
        100,
        45 + bucket.destructiveCount * 15 + bucket.destructiveDocuments.size * 5,
      );
      const reasons = [
        `${bucket.destructiveCount} destructive document events`,
        `${bucket.destructiveDocuments.size} distinct documents`,
      ];

      signals.push(
        this.createBehaviorSignal(
          'DESTRUCTIVE_ACTIVITY',
          bucket.actorId,
          bucket.destructiveCount,
          bucket.destructiveDocuments.size,
          bucket.windowStartedAt,
          bucket.windowEndedAt,
          riskScore,
          reasons,
        ),
      );
    }

    return signals;
  }

  private createBehaviorSignal(
    type: BehaviorSignalType,
    actorId: string,
    actionCount: number,
    documentCount: number,
    windowStartedAt: Date,
    windowEndedAt: Date,
    riskScore: number,
    reasons: string[],
  ): BehaviorSignalSummary {
    return {
      signalId: `${type}:${actorId}`,
      type,
      severity: this.behaviorSeverity(riskScore),
      actorId,
      actionCount,
      documentCount,
      windowStartedAt: windowStartedAt.toISOString(),
      windowEndedAt: windowEndedAt.toISOString(),
      riskScore,
      reasons,
    };
  }

  private behaviorSeverity(riskScore: number): BehaviorSignalSeverity {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 50) return 'warning';
    return 'watch';
  }

  private buildSecurityRecommendations(input: {
    chain: Awaited<ReturnType<AuditService['verifyChain']>>;
    totals: {
      deniedEvents: number;
      malwareBlocked: number;
      dlpDetections: number;
      downloadDenied: number;
    };
    repeatedDenyActors: Array<{ actorId: string; denyCount: number }>;
    riskyDocuments: RiskyDocumentSummary[];
    behaviorSignals: BehaviorSignalSummary[];
  }): SecurityRecommendationSummary[] {
    const recommendations: SecurityRecommendationSummary[] = [];

    if (input.chain.valid === false) {
      recommendations.push({
        id: 'audit-chain-review',
        type: 'AUDIT_CHAIN_REVIEW',
        severity: 'critical',
        title: 'Verify audit-chain integrity before exporting evidence',
        reason:
          input.chain.message ??
          'Audit hash-chain verification reported an integrity mismatch.',
        recommendedAction:
          'Run tamper-evidence verification, isolate the audit store, and compare the broken event with trusted backups.',
        evidence: [
          `${input.chain.checked} audit ${this.plural(input.chain.checked, 'event')} checked`,
        ],
        affectedDocumentIds: [],
        affectedActorIds: [],
        auditFilters: {},
      });
    }

    for (const document of input.riskyDocuments) {
      if (document.riskScore < 50) continue;

      const severity: SecurityRecommendationSeverity =
        document.riskScore >= 80 ? 'critical' : 'warning';
      recommendations.push({
        id: `document-access-review:${document.documentId}`,
        type: 'DOCUMENT_ACCESS_REVIEW',
        severity,
        title:
          severity === 'critical'
            ? `Tighten access for high-risk ${document.classification} document`
            : `Review access for elevated-risk ${document.classification} document`,
        reason: `Document ${document.documentId} reached risk score ${document.riskScore} from classification and access metadata.`,
        recommendedAction:
          'Review ACLs, confirm business need for recent grants, and keep watermark-required delivery for sensitive content.',
        evidence: document.reasons,
        affectedDocumentIds: [document.documentId],
        affectedActorIds: [],
        auditFilters: { documentId: document.documentId },
      });
    }

    const actorRecommendationKeys = new Set<string>();

    for (const signal of input.behaviorSignals) {
      if (signal.riskScore < 50) continue;

      actorRecommendationKeys.add(`${signal.type}:${signal.actorId}`);
      recommendations.push({
        id: `actor-access-review:${signal.type}:${signal.actorId}`,
        type: 'ACTOR_ACCESS_REVIEW',
        severity:
          signal.severity === 'critical'
            ? 'critical'
            : signal.severity === 'warning'
              ? 'warning'
              : 'info',
        title: this.getBehaviorRecommendationTitle(signal),
        reason: `Actor ${signal.actorId} triggered ${signal.type} with score ${signal.riskScore} across ${signal.documentCount} ${this.plural(signal.documentCount, 'document')}.`,
        recommendedAction: this.getBehaviorRecommendationAction(signal.type),
        evidence: signal.reasons,
        affectedDocumentIds: [],
        affectedActorIds: [signal.actorId],
        auditFilters: { actorId: signal.actorId },
      });
    }

    for (const actor of input.repeatedDenyActors) {
      if (actorRecommendationKeys.has(`DENY_BURST:${actor.actorId}`)) continue;

      recommendations.push({
        id: `actor-access-review:repeated-deny:${actor.actorId}`,
        type: 'ACTOR_ACCESS_REVIEW',
        severity: 'warning',
        title: `Review repeated denied access for ${actor.actorId}`,
        reason: `Actor ${actor.actorId} has ${actor.denyCount} denied audit events.`,
        recommendedAction:
          'Inspect role, group membership, and ACL assignments before broadening access.',
        evidence: [
          `${actor.denyCount} denied ${this.plural(actor.denyCount, 'event')}`,
        ],
        affectedDocumentIds: [],
        affectedActorIds: [actor.actorId],
        auditFilters: { actorId: actor.actorId },
      });
    }

    if (input.totals.dlpDetections > 0) {
      recommendations.push({
        id: 'dlp-classification-review',
        type: 'DLP_CLASSIFICATION_REVIEW',
        severity: 'warning',
        title: 'Review DLP-driven classification controls',
        reason: `${input.totals.dlpDetections} DLP detection ${this.plural(input.totals.dlpDetections, 'event')} ${this.wasWere(input.totals.dlpDetections)} recorded in the audit summary.`,
        recommendedAction:
          'Confirm classification escalation, verify override reasons, and block unsafe downgrade paths.',
        evidence: [
          `${input.totals.dlpDetections} DLP detection ${this.plural(input.totals.dlpDetections, 'event')}`,
        ],
        affectedDocumentIds: [],
        affectedActorIds: [],
        auditFilters: { action: 'DLP_PATTERN_DETECTED' },
      });
    }

    if (input.totals.malwareBlocked > 0) {
      recommendations.push({
        id: 'malware-upload-review',
        type: 'MALWARE_UPLOAD_REVIEW',
        severity: 'warning',
        title: 'Review blocked malware upload attempts',
        reason: `${input.totals.malwareBlocked} malware upload ${this.plural(input.totals.malwareBlocked, 'attempt')} ${input.totals.malwareBlocked === 1 ? 'was' : 'were'} blocked before object storage.`,
        recommendedAction:
          'Review source actor, checksum, filename, and endpoint context for the blocked upload.',
        evidence: [
          `${input.totals.malwareBlocked} malware ${this.plural(input.totals.malwareBlocked, 'upload')} blocked`,
        ],
        affectedDocumentIds: [],
        affectedActorIds: [],
        auditFilters: { action: 'MALWARE_UPLOAD_BLOCKED' },
      });
    }

    return recommendations.slice(0, 8);
  }

  private async recordRecommendationView(
    viewer: SecuritySummaryViewer | undefined,
    recommendations: SecurityRecommendationSummary[],
  ): Promise<void> {
    if (!viewer?.actorId) return;

    const recommendationIds = recommendations.map(
      (recommendation) => recommendation.id,
    );
    const criticalCount = recommendations.filter(
      (recommendation) => recommendation.severity === 'critical',
    ).length;
    const warningCount = recommendations.filter(
      (recommendation) => recommendation.severity === 'warning',
    ).length;

    await this.create({
      timestamp: new Date().toISOString(),
      actorId: viewer.actorId,
      actorRoles: viewer.roles ?? [],
      action: 'SECURITY_RECOMMENDATIONS_VIEWED',
      resourceType: 'AUDIT',
      result: 'SUCCESS',
      ip: viewer.ip,
      traceId: viewer.traceId,
      metadata: {
        recommendationCount: recommendations.length,
        recommendationIds,
        criticalCount,
        warningCount,
        recommendationTypes: Array.from(
          new Set(
            recommendations.map((recommendation) => recommendation.type),
          ),
        ),
        auditFilters: recommendations.map((recommendation) => ({
          id: recommendation.id,
          filters: recommendation.auditFilters,
        })),
      },
    });
  }

  private getBehaviorRecommendationTitle(signal: BehaviorSignalSummary): string {
    switch (signal.type) {
      case 'MASS_CONTENT_ACCESS':
        return `Review mass content access by ${signal.actorId}`;
      case 'DENY_BURST':
        return `Investigate denied access burst for ${signal.actorId}`;
      case 'DESTRUCTIVE_ACTIVITY':
        return `Review destructive document activity by ${signal.actorId}`;
    }
  }

  private getBehaviorRecommendationAction(
    type: BehaviorSignalType,
  ): string {
    switch (type) {
      case 'MASS_CONTENT_ACCESS':
        return 'Confirm business need, inspect document spread, and tighten ACLs for sensitive documents.';
      case 'DENY_BURST':
        return 'Inspect role, group membership, and ACL assignments before broadening access.';
      case 'DESTRUCTIVE_ACTIVITY':
        return 'Review workflow history, validate retention intent, and restore documents if activity was unauthorized.';
    }
  }

  private plural(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
  }

  private wasWere(count: number): string {
    return count === 1 ? 'was' : 'were';
  }

  private isDeniedSecurityEvent(event: {
    action?: unknown;
    result?: unknown;
  }): boolean {
    return (
      event.result === 'DENY' ||
      event.action === 'DOCUMENT_DOWNLOAD_DENIED' ||
      event.action === 'DOCUMENT_METADATA_READ_DENIED'
    );
  }

  private isDestructiveAction(action: unknown): boolean {
    return (
      action === 'DOCUMENT_ACL_DELETED' ||
      action === 'DOCUMENT_ARCHIVE' ||
      action === 'DOCUMENT_AUTO_ARCHIVED'
    );
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
