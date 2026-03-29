import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum WorkflowAction {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  ARCHIVE = 'ARCHIVE',
  DELETE = 'DELETE',
}

export class UpdateStatusDto {
  @IsEnum(DocumentStatus, {
    message: `status must be one of: ${Object.values(DocumentStatus).join(', ')}`,
  })
  @ApiProperty({ enum: DocumentStatus })
  status!: string;

  @IsEnum(WorkflowAction, {
    message: `action must be one of: ${Object.values(WorkflowAction).join(', ')}`,
  })
  @ApiProperty({ enum: WorkflowAction })
  action!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Required when action is REJECT' })
  reason?: string;
}
