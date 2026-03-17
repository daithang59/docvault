import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuditEventDto) {
    // Fetch the hash of the most recent event for chain linking
    const lastEvent = await this.prisma.auditEvent.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { hash: true },
    });

    const prevHash = lastEvent?.hash ?? null;

    // Build canonical payload for deterministic hashing
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

    return this.prisma.auditEvent.create({
      data: {
        eventId: dto.eventId,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
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
      },
    });
  }

  query(dto: QueryAuditDto) {
    const where: Prisma.AuditEventWhereInput = {
      actorId: dto.actorId,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      result: dto.result,
      timestamp:
        dto.from || dto.to
          ? {
              gte: dto.from ? new Date(dto.from) : undefined,
              lte: dto.to ? new Date(dto.to) : undefined,
            }
          : undefined,
    };

    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: dto.limit ?? 100,
    });
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
