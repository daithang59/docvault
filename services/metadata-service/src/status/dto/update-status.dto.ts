import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DOCUMENT_STATUS_VALUES = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'ARCHIVED',
  'DELETED',
] as const;
const WORKFLOW_ACTIONS = ['SUBMIT', 'APPROVE', 'REJECT', 'ARCHIVE', 'DELETE'] as const;

export class UpdateStatusDto {
  @IsEnum(DOCUMENT_STATUS_VALUES, {
    message: `status must be one of: ${DOCUMENT_STATUS_VALUES.join(', ')}`,
  })
  @ApiProperty({ enum: DOCUMENT_STATUS_VALUES })
  status!: string;

  @IsEnum(WORKFLOW_ACTIONS, {
    message: `action must be one of: ${WORKFLOW_ACTIONS.join(', ')}`,
  })
  @ApiProperty({ enum: WORKFLOW_ACTIONS })
  action!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Required when action is REJECT' })
  reason?: string;
}
