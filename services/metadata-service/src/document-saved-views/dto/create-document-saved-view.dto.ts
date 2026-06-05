import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum DocumentSavedViewScope {
  PRIVATE = 'PRIVATE',
  TEAM = 'TEAM',
}

export class CreateDocumentSavedViewDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { status: ['PENDING'], classification: ['CONFIDENTIAL'] },
  })
  @IsObject()
  filters!: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: DocumentSavedViewScope,
    default: DocumentSavedViewScope.PRIVATE,
  })
  @IsOptional()
  @IsEnum(DocumentSavedViewScope)
  scope?: DocumentSavedViewScope;
}
