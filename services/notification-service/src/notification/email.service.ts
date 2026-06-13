import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends transactional emails via a cloud provider (Resend HTTP API).
 *
 * Fail-safe by design: if EMAIL_API_KEY / EMAIL_FROM are not configured, the
 * service is a no-op (logs and returns) so notification delivery never breaks
 * just because email transport is unconfigured. Mirrors the audit-signing
 * "no secret => disabled" approach.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private get apiKey(): string | undefined {
    return process.env.EMAIL_API_KEY?.trim() || undefined;
  }

  private get from(): string | undefined {
    return process.env.EMAIL_FROM?.trim() || undefined;
  }

  /** Whether email transport is configured and enabled. */
  isEnabled(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  /**
   * Send an email. Returns true if accepted by the provider, false if email
   * is disabled or the send failed (never throws — callers fire-and-forget).
   */
  async send(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Email disabled (EMAIL_API_KEY/EMAIL_FROM unset) — skipped: "${input.subject}" to ${input.to}`,
      );
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: input.to,
          subject: input.subject,
          text: input.text,
        }),
      });

      if (!res.ok) {
        this.logger.warn(
          `Email send failed (${res.status}) for "${input.subject}" to ${input.to}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Email transport error: ${(err as Error).message}`);
      return false;
    }
  }
}
