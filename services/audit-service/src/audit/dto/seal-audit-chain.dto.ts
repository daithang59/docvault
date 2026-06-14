import { IsString, MaxLength, MinLength } from 'class-validator';

export class SealAuditChainDto {
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  reason!: string;
}
