import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const STEP_UP_PROOF_HEADER = 'x-docvault-step-up-proof';

export type SensitiveMetadataAction =
  | 'export-evidence-packet'
  | 'run-retention';

const PROOF_TTL_MS = 5 * 60 * 1000;

const SENSITIVE_ACTIONS: Record<
  SensitiveMetadataAction,
  { challengePhrase: string }
> = {
  'export-evidence-packet': {
    challengePhrase: 'EXPORT EVIDENCE',
  },
  'run-retention': {
    challengePhrase: 'RUN RETENTION',
  },
};

interface SensitiveActionProofPayload {
  actor: string;
  action: SensitiveMetadataAction;
  expiresAt: number;
  nonce: string;
}

export interface RecentAuthStatus {
  checked: boolean;
  maxAgeSeconds: number;
  authTime?: string;
  ageSeconds?: number;
}

@Injectable()
export class SensitiveActionProofService {
  issueProof(
    req: any,
    body: { action?: unknown; challengePhrase?: unknown },
  ): { proof: string; expiresAt: string; reauth: RecentAuthStatus } {
    const action = this.parseAction(body.action);
    const expectedPhrase = SENSITIVE_ACTIONS[action].challengePhrase;

    if (
      normalizePhrase(body.challengePhrase) !== normalizePhrase(expectedPhrase)
    ) {
      throw new BadRequestException('Invalid sensitive action challenge phrase');
    }

    const actor = this.getActor(req);
    const reauth = this.getRecentAuthStatus(req);
    const expiresAt = Date.now() + PROOF_TTL_MS;
    const payload: SensitiveActionProofPayload = {
      actor,
      action,
      expiresAt,
      nonce: randomUUID(),
    };

    return {
      proof: this.signPayload(payload),
      expiresAt: new Date(expiresAt).toISOString(),
      reauth,
    };
  }

  assertProof(req: any, action: SensitiveMetadataAction): void {
    const proof = this.getProofHeader(req);
    if (!proof) {
      throwInvalidProof();
    }

    const payload = this.verifyProof(proof);
    const actor = this.getActor(req);
    if (
      payload.actor !== actor ||
      payload.action !== action ||
      payload.expiresAt <= Date.now()
    ) {
      throwInvalidProof();
    }
  }

  private parseAction(action: unknown): SensitiveMetadataAction {
    if (
      typeof action === 'string' &&
      Object.prototype.hasOwnProperty.call(SENSITIVE_ACTIONS, action)
    ) {
      return action as SensitiveMetadataAction;
    }

    throw new BadRequestException('Unsupported sensitive action');
  }

  private getActor(req: any): string {
    const actor = req?.user?.sub ?? req?.user?.username;
    if (typeof actor === 'string' && actor.trim().length > 0) {
      return actor;
    }

    throw new ForbiddenException('Sensitive action actor is required');
  }

  private getProofHeader(req: any): string | undefined {
    const headers = req?.headers ?? {};
    const direct = headers[STEP_UP_PROOF_HEADER];
    if (direct) {
      return firstHeaderValue(direct);
    }

    const header = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === STEP_UP_PROOF_HEADER,
    )?.[1];
    return firstHeaderValue(header);
  }

  private getRecentAuthStatus(req: any): RecentAuthStatus {
    const maxAgeSeconds = this.getRecentAuthMaxAgeSeconds();
    const authTimeSeconds = Number(req?.user?.raw?.auth_time);
    const requireRecentAuth = isEnabled(
      process.env.SENSITIVE_ACTION_REQUIRE_RECENT_AUTH,
    );

    if (!Number.isFinite(authTimeSeconds)) {
      if (requireRecentAuth) {
        throw new ForbiddenException(
          'Recent authentication is required for sensitive actions',
        );
      }

      return {
        checked: false,
        maxAgeSeconds,
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - authTimeSeconds;
    if (ageSeconds > maxAgeSeconds) {
      throw new ForbiddenException(
        'Recent authentication is required for sensitive actions',
      );
    }

    return {
      checked: true,
      maxAgeSeconds,
      authTime: new Date(authTimeSeconds * 1000).toISOString(),
      ageSeconds,
    };
  }

  private getRecentAuthMaxAgeSeconds(): number {
    const value = Number(process.env.SENSITIVE_ACTION_REAUTH_MAX_AGE_SECONDS);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 600;
  }

  private signPayload(payload: SensitiveActionProofPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    return `${encodedPayload}.${this.signature(encodedPayload)}`;
  }

  private verifyProof(proof: string): SensitiveActionProofPayload {
    const [encodedPayload, signature, extra] = proof.split('.');
    if (!encodedPayload || !signature || extra !== undefined) {
      throwInvalidProof();
    }

    if (!this.isExpectedSignature(encodedPayload, signature)) {
      throwInvalidProof();
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );
      if (isProofPayload(payload)) {
        return payload;
      }
    } catch {
      throwInvalidProof();
    }

    throwInvalidProof();
  }

  private isExpectedSignature(
    encodedPayload: string,
    actualSignature: string,
  ): boolean {
    const expected = Buffer.from(this.signature(encodedPayload), 'base64url');
    const actual = Buffer.from(actualSignature, 'base64url');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private signature(encodedPayload: string): string {
    return createHmac('sha256', this.getSecret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private getSecret(): string {
    const secret =
      process.env.SENSITIVE_ACTION_PROOF_SECRET ??
      process.env.KEYCLOAK_CLIENT_SECRET;
    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException(
        'SENSITIVE_ACTION_PROOF_SECRET is required',
      );
    }

    return 'dev-sensitive-action-proof-secret';
  }
}

function normalizePhrase(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function firstHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function isProofPayload(value: unknown): value is SensitiveActionProofPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as SensitiveActionProofPayload;
  return (
    typeof payload.actor === 'string' &&
    Object.prototype.hasOwnProperty.call(SENSITIVE_ACTIONS, payload.action) &&
    Number.isFinite(payload.expiresAt) &&
    typeof payload.nonce === 'string'
  );
}

function throwInvalidProof(): never {
  throw new ForbiddenException('Invalid or expired sensitive action proof');
}
