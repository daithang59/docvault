import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum NotifyType {
  SUBMITTED = 'SUBMITTED',
  APPROVED  = 'APPROVED',
  REJECTED  = 'REJECTED',
  ARCHIVED  = 'ARCHIVED',
  DELETED   = 'DELETED',
}

export class NotifyDto {
  @IsEnum(NotifyType)
  type!: NotifyType;

  @IsString()
  docId!: string;

  /** Single recipient — used for APPROVED / REJECTED / ARCHIVED / DELETED */
  @IsOptional()
  @IsString()
  recipientId?: string;

  /** Multi-recipient — used for SUBMITTED (all approvers + admins) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];

  /** Document title for UI display */
  @IsOptional()
  @IsString()
  docTitle?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}
