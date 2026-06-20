import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MaxLength(1024)
  objectKey!: string;

  @IsString()
  checksum!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;

  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsIn(['NOT_SCANNED', 'CLEAR', 'DETECTED'])
  dlpStatus?: string;

  @IsOptional()
  @IsArray()
  dlpFindings?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  dlpSuggestedClassification?: string;
}
