import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocumentSharePermission {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
}

export class CreateShareLinkDto {
  @IsOptional()
  @IsEnum(DocumentSharePermission)
  @ApiPropertyOptional({ enum: DocumentSharePermission, default: 'VIEW' })
  permission?: DocumentSharePermission;

  @IsInt()
  @Min(1)
  @Max(720)
  @ApiProperty({
    minimum: 1,
    maximum: 720,
    description: 'Link lifetime in hours (max 30 days).',
  })
  expiresInHours!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1000,
    description: 'Optional maximum number of times the link can be opened.',
  })
  maxAccessCount?: number;
}
