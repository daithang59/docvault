import { Injectable, Logger } from '@nestjs/common';
import { NotifyDto, NotifyType } from './dto/notify.dto';

export interface NotificationRecord {
  id: string;
  type: NotifyType;
  docId: string;
  actorId: string;
  reason?: string;
  traceId?: string;
  createdAt: string;
  read: boolean;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** In-memory store — keyed by userId */
  private readonly store = new Map<string, NotificationRecord[]>();

  notify(dto: NotifyDto): { accepted: boolean; type: string; docId: string } {
    const record: NotificationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: dto.type,
      docId: dto.docId,
      actorId: dto.actorId,
      reason: dto.reason,
      traceId: dto.traceId,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const userId = dto.actorId;
    const existing = this.store.get(userId) ?? [];
    this.store.set(userId, [record, ...existing].slice(0, 100));

    this.logger.log(JSON.stringify({ ...dto, stored: true }));

    return {
      accepted: true,
      type: dto.type,
      docId: dto.docId,
    };
  }

  getForUser(userId: string): NotificationRecord[] {
    return this.store.get(userId) ?? [];
  }

  markAllRead(userId: string): void {
    const records = this.store.get(userId);
    if (records) {
      records.forEach((r) => (r.read = true));
    }
  }

  getUnreadCount(userId: string): number {
    return (this.store.get(userId) ?? []).filter((r) => !r.read).length;
  }
}
