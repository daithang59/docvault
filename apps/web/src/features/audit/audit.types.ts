import type { AuditResult } from '@/types/enums';
import type { PaginationParams } from '@/types/pagination';

export interface AuditLogItemDto {
  eventId: string;
  action: string;
  actorId: string;
  actorRoles: string[];
  result: AuditResult;
  resourceType: string;
  resourceId?: string | null;
  timestamp: string;
  reason?: string | null;
  ip?: string | null;
  traceId?: string | null;
  prevHash?: string | null;
  hash?: string;
  id?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export type AuditLogEntry = AuditLogItemDto;

export interface AuditQueryFilters extends PaginationParams {
  actorId?: string;
  action?: string;
  result?: AuditResult;
  resourceId?: string;
  resourceType?: string;
  documentId?: string;
  aclId?: string;
  from?: string;
  to?: string;
  limit?: number;
  targetId?: string;
  targetType?: string;
}

export interface AuditChainStatus {
  valid: boolean;
  checked: number;
  firstBrokenIndex?: number;
  firstBrokenEventId?: string;
  lastTrustedHash?: string;
  message?: string;
  epochId?: string;
  activeEpoch?: {
    epochId: string;
    status: string;
    valid: boolean;
    checked: number;
    startedAt?: string;
    genesisReason?: string;
    previousEpochId?: string;
    incidentId?: string;
  };
  historicalCompromisedCount?: number;
  compromisedEpochs?: Array<{
    epochId: string;
    status: 'COMPROMISED';
    startedAt?: string;
    endedAt?: string;
    incidentId?: string;
    firstBrokenIndex?: number;
    firstBrokenEventId?: string;
    lastTrustedHash?: string;
    reason?: string;
  }>;
}

export interface SealAuditChainRequest {
  reason: string;
}

export interface SealAuditChainResponse {
  incident: Record<string, unknown>;
  previousEpoch: Record<string, unknown>;
  newEpoch: {
    epochId: string;
    status: string;
    previousEpochId?: string;
    genesisReason?: string;
    incidentId?: string;
  };
  event: AuditLogItemDto;
}

export interface RiskyDocumentSummary {
  documentId: string;
  classification: string;
  accessCount: number;
  actorCount: number;
  latestAccessAt: string;
  riskScore: number;
  reasons: string[];
}

export type BehaviorSignalType =
  | 'MASS_CONTENT_ACCESS'
  | 'DENY_BURST'
  | 'DESTRUCTIVE_ACTIVITY';

export interface BehaviorSignalSummary {
  signalId: string;
  type: BehaviorSignalType;
  severity: 'critical' | 'warning' | 'watch';
  actorId: string;
  actionCount: number;
  documentCount: number;
  windowStartedAt: string;
  windowEndedAt: string;
  riskScore: number;
  reasons: string[];
}

export type SecurityRecommendationType =
  | 'AUDIT_CHAIN_REVIEW'
  | 'DLP_CLASSIFICATION_REVIEW'
  | 'MALWARE_UPLOAD_REVIEW'
  | 'DOCUMENT_ACCESS_REVIEW'
  | 'ACTOR_ACCESS_REVIEW';

export type SecurityRecommendationWorkflowStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'REVIEWED'
  | 'RESOLVED';

export interface SecurityRecommendationWorkflow {
  status: SecurityRecommendationWorkflowStatus;
  note?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export type SecurityRecommendationWorkflowSummary = SecurityRecommendationWorkflow;

export interface SecurityRecommendationWorkflowHistoryEntry {
  eventId: string;
  status: SecurityRecommendationWorkflowStatus;
  note?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SecurityRecommendationWorkflowRequest {
  status: SecurityRecommendationWorkflowStatus;
  note?: string;
}

export type UpdateSecurityRecommendationWorkflowRequest =
  SecurityRecommendationWorkflowRequest;

export interface SecurityRecommendationSummary {
  id: string;
  type: SecurityRecommendationType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  reason: string;
  recommendedAction: string;
  evidence: string[];
  affectedDocumentIds: string[];
  affectedActorIds: string[];
  auditFilters: AuditQueryFilters;
  workflow?: SecurityRecommendationWorkflow;
}

export interface SecuritySummary {
  chain: AuditChainStatus;
  totals: {
    deniedEvents: number;
    malwareBlocked: number;
    dlpDetections: number;
    downloadDenied: number;
  };
  repeatedDenyActors: Array<{
    actorId: string;
    denyCount: number;
  }>;
  riskyDocuments: RiskyDocumentSummary[];
  behaviorSignals: BehaviorSignalSummary[];
  recommendations: SecurityRecommendationSummary[];
}
