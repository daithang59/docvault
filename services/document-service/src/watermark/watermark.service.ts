import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export type WatermarkContext = {
  username: string;
  timestamp: string;
  classification: string;
};

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  /**
   * Apply watermark based on content type.
   * - PDF: embed visible diagonal text watermark on every page (valid PDF output)
   * - Others: prepend UTF-8 header (legacy fallback)
   */
  async applyWatermark(
    data: Buffer,
    ctx: WatermarkContext,
    contentType?: string,
  ): Promise<Buffer> {
    const type = (contentType ?? '').toLowerCase();


    if (type.includes('application/pdf')) {
      // Validate actual PDF magic bytes — some files have .pdf extension but are HTML/DOCX
      const header = data.subarray(0, 5).toString('ascii');
      if (!header.startsWith('%PDF')) {
        this.logger.warn(
          `Content-type is ${contentType} but file header is "${header.replace(/[\x00-\x1f]/g, '?')}" — skipping PDF watermark`,
        );
        return data;
      }

      try {
        return await this.applyPdfWatermark(data, ctx);
      } catch (err) {
        this.logger.error(
          `PDF watermark failed, returning original file: ${(err as Error).message}`,
          (err as Error).stack,
        );
        return data;
      }
    }

    // Non-PDF formats (DOCX, XLSX, images, etc.) — cannot safely watermark binary files
    this.logger.log(
      `Watermark skipped for non-PDF content-type: ${contentType ?? 'unknown'}`,
    );
    return data;
  }

  private applyLegacyHeaderWatermark(data: Buffer, ctx: WatermarkContext): Buffer {
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

  private async applyPdfWatermark(data: Buffer, ctx: WatermarkContext): Promise<Buffer> {
    // Explicitly convert Node Buffer → Uint8Array for pdf-lib compatibility
    const uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const pdfDoc = await PDFDocument.load(uint8, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const line1 = `${ctx.classification}  -  DOCVAULT`;
    const line2 = `${ctx.username}  -  ${ctx.timestamp.replace('T', ' ').replace(/\.\d+Z$/, '')}`;

    const angleDeg = -35;
    const angleRad = (angleDeg * Math.PI) / 180;

    // Perpendicular "below" direction for the rotated text
    const perpX = Math.sin(angleRad);   // moves along perpendicular x
    const perpY = -Math.cos(angleRad);  // moves along perpendicular y

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();

      const fontSize = Math.max(16, Math.min(width, height) * 0.028);
      const smallFontSize = fontSize * 0.72;
      const lineGap = fontSize * 1.1;  // gap between line1 and line2

      // Tile spacing
      const spacingX = 340;
      const spacingY = 220;

      // Extend beyond page to cover corners after rotation
      const margin = Math.max(width, height) * 0.6;

      for (let baseY = -margin; baseY < height + margin; baseY += spacingY) {
        for (let baseX = -margin; baseX < width + margin; baseX += spacingX) {
          // Line 1: classification
          page.drawText(line1, {
            x: baseX,
            y: baseY,
            size: fontSize,
            font,
            color: rgb(0.45, 0.05, 0.60),
            opacity: 0.15,
            rotate: degrees(angleDeg),
          });

          // Line 2: user + timestamp (offset perpendicular below line 1)
          page.drawText(line2, {
            x: baseX + perpX * lineGap,
            y: baseY + perpY * lineGap,
            size: smallFontSize,
            font,
            color: rgb(0.45, 0.05, 0.60),
            opacity: 0.11,
            rotate: degrees(angleDeg),
          });
        }
      }
    }

    const bytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false,
    });

    return Buffer.from(bytes);
  }
}

