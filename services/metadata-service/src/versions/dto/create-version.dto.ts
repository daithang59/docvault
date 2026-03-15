import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
