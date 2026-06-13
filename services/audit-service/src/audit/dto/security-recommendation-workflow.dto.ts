import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const SECURITY_RECOMMENDATION_WORKFLOW_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'REVIEWED',
  'RESOLVED',
] as const;

export type SecurityRecommendationWorkflowStatus =
  (typeof SECURITY_RECOMMENDATION_WORKFLOW_STATUSES)[number];

export class SecurityRecommendationWorkflowDto {
  @IsIn(SECURITY_RECOMMENDATION_WORKFLOW_STATUSES)
  status!: SecurityRecommendationWorkflowStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
