import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { AuditEvent, AuditEventDocument } from '../mongo/audit-event.schema';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditEvent: Model<AuditEventDocument>,
  ) {}

  async create(dto: CreateAuditEventDto) {
    // 1. Get hash of the most recent event for chain linking
    const lastEvent = await this.auditEvent
      .findOne({}, { hash: 1 })
      .sort({ timestamp: -1 })
      .lean();

    const prevHash = lastEvent?.hash ?? null;

    // 2. Build canonical payload for deterministic hashing
    const canonicalPayload = this.buildCanonicalPayload({
      eventId: dto.eventId,
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
    });

    const hash = this.computeHash(prevHash, canonicalPayload);

    // 3. Insert the event
    const saved = await this.auditEvent.create({
      eventId: dto.eventId,
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

    return this.auditEvent
      .find(filter, { _id: 0 })
      .sort({ timestamp: -1 })
      .limit(dto.limit ?? 100)
      .lean();
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
}
