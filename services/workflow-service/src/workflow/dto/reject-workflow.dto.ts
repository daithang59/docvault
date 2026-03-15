import { IsOptional, IsString } from 'class-validator';

export class RejectWorkflowDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
