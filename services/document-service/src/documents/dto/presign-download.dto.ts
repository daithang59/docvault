import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PresignDownloadDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  /** Pre-authorized grant token from authorizeDownload — skips re-authorization */
  @IsOptional()
  @IsString()
  grantToken?: string;
}
