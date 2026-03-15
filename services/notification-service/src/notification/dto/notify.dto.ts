import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum NotifyType {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class NotifyDto {
  @IsEnum(NotifyType)
  type!: NotifyType;

  @IsString()
  docId!: string;

  @IsString()
  actorId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}
