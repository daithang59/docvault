import { Injectable, Logger } from '@nestjs/common';
import { NotifyDto, NotifyType } from './dto/notify.dto';

export interface NotificationRecord {
  id: string;
  type: NotifyType;
  docId: string;
  recipientId: string; // who should see this notification
  docTitle?: string;
  reason?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

export interface NotificationPage {
  records: NotificationRecord[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** In-memory store — keyed by recipientId (the user who sees the notification) */
  private readonly store = new Map<string, NotificationRecord[]>();

  private uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Creates one record per unique recipient and stores it under that recipient's key.
   * Either recipientId or recipientIds (or both) may be supplied.
   */
  notify(dto: NotifyDto): {
    accepted: boolean;
    type: string;
    docId: string;
    recipients: string[];
  } {
    const recipients = [
      ...(dto.recipientIds ?? []),
      ...(dto.recipientId ? [dto.recipientId] : []),
    ];
    const unique = [...new Set(recipients)];

    const base = {
      type: dto.type,
      docId: dto.docId,
      docTitle: dto.docTitle,
      reason: dto.reason,
      traceId: dto.traceId,
      ...(dto.metadata && {
        metadata: sanitizeNotificationMetadata(dto.metadata),
      }),
    };

    for (const recipientId of unique) {
      const record: NotificationRecord = {
        ...base,
        recipientId,
        id: this.uid(),
        createdAt: new Date().toISOString(),
        read: false,
      };
      const existing = this.store.get(recipientId) ?? [];
      // Cap at 100 per user to bound memory
      this.store.set(recipientId, [record, ...existing].slice(0, 100));
    }

    this.logger.log(
      JSON.stringify({
        stored: true,
        type: dto.type,
        docId: dto.docId,
        recipients: unique,
      }),
    );

    return {
      accepted: true,
      type: dto.type,
      docId: dto.docId,
      recipients: unique,
    };
  }

  /**
   * Returns a paginated slice of the user's notifications.
   * page is 1-based; limit is clamped to 1..100.
   */
  getForUser(userId: string, page = 1, limit = 20): NotificationPage {
    const all = this.store.get(userId) ?? [];
    const total = all.length;
    const safeL = Math.min(Math.max(1, limit), 100);
    const safeP = Math.max(1, page);
    const start = (safeP - 1) * safeL;
    return {
      records: all.slice(start, start + safeL),
      total,
      page: safeP,
      pages: Math.ceil(total / safeL),
    };
  }

  getUnreadCount(userId: string): number {
    return (this.store.get(userId) ?? []).filter((r) => !r.read).length;
  }

  /**
   * Mark one notification as read by its global id.
   * Returns true if found and updated, false if not found.
   */
  markAsRead(id: string): boolean {
    for (const records of this.store.values()) {
      const idx = records.findIndex((r) => r.id === id);
      if (idx !== -1) {
        records[idx].read = true;
        return true;
      }
    }
    return false;
  }

  markAllRead(userId: string): void {
    const records = this.store.get(userId);
    if (records) records.forEach((r) => (r.read = true));
  }
}

const NOTIFICATION_SENSITIVE_FIELD_NAMES = [
  'fileContent',
  'objectKey',
  'storagePath',
  'presignedUrl',
  'grantToken',
  'downloadToken',
] as const;

function sanitizeNotificationMetadata(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeNotificationValue(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitizeNotificationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeNotificationValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, nestedValue]) => {
    if (isSensitiveNotificationField(key)) {
      return acc;
    }

    acc[key] = sanitizeNotificationValue(nestedValue);
    return acc;
  }, {});
}

function isSensitiveNotificationField(key: string): boolean {
  return (NOTIFICATION_SENSITIVE_FIELD_NAMES as readonly string[]).includes(
    key,
  );
}
