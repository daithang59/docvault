import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Classification } from './create-document.dto';

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
  @IsEnum(Classification, {
    message: `classification must be one of: ${Object.values(Classification).join(', ')}`,
  })
  @ApiPropertyOptional({ enum: Classification })
  classification?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @ApiPropertyOptional({ type: [String], example: ['report', 'finance'] })
  tags?: string[];
}
