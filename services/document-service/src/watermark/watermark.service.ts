import { Injectable } from '@nestjs/common';

export type WatermarkContext = {
  username: string;
  timestamp: string;
  classification: string;
};

/**
 * Phase 1: prepends a UTF-8 text header to raw bytes.
 *
 * The header uses a clear delimiter so clients can strip it.
 * Most binary formats ignore leading bytes they don't understand;
 * text-based formats will see the header as a comment block.
 *
 * Phase 2 (future): use pdf-lib for PDF, sharp for images
 * to embed watermark directly into file content.
 */
@Injectable()
export class WatermarkService {
  applyWatermark(data: Buffer, ctx: WatermarkContext): Buffer {
    const header = [
      '---DOCVAULT-WATERMARK---',
      `CLASSIFICATION: ${ctx.classification}`,
      `USER: ${ctx.username}`,
      `TIME: ${ctx.timestamp}`,
      'DOCVAULT — AUTHORIZED USE ONLY',
      '---DOCVAULT-WATERMARK---',
      '',
    ].join('\n');

    return Buffer.concat([Buffer.from(header, 'utf8'), data]);
  }
}
