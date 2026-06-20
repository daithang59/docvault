import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LegalHoldDto {
  @IsBoolean()
  @ApiProperty({
    description:
      'Whether the document should be under legal hold. When true, retention auto-archive is suspended.',
  })
  hold!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Reason for the hold. Required when placing a hold.',
  })
  reason?: string;
}
