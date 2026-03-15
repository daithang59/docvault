import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DownloadAuthorizeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
