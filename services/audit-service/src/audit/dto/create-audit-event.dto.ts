import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateAuditEventDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @IsString()
  actorId!: string;

  @IsArray()
  actorRoles!: string[];

  @IsString()
  @MaxLength(120)
  action!: string;

  @IsString()
  @MaxLength(120)
  resourceType!: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsString()
  @MaxLength(40)
  result!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
