import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const CLASSIFICATION_VALUES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsEnum(CLASSIFICATION_VALUES, {
    message: `classification must be one of: ${CLASSIFICATION_VALUES.join(', ')}`,
  })
  @ApiPropertyOptional({ enum: CLASSIFICATION_VALUES })
  classification?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @ApiPropertyOptional({ type: [String], example: ['report', 'finance'] })
  tags?: string[];
}
