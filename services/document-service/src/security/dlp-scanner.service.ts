import { Injectable, Logger } from '@nestjs/common';

export type DlpFinding = {
  type: 'EMAIL' | 'PHONE' | 'NATIONAL_ID' | 'KEYWORD';
  pattern: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  count: number;
};

export type DlpScanResult =
  | {
      status: 'CLEAR';
      findings: [];
    }
  | {
      status: 'DETECTED';
      findings: DlpFinding[];
      suggestedClassification: 'CONFIDENTIAL';
    };

type Rule = {
  type: DlpFinding['type'];
  pattern: string;
  severity: DlpFinding['severity'];
  regex: RegExp;
};

const RULES: Rule[] = [
  {
    type: 'EMAIL',
    pattern: 'email address',
    severity: 'MEDIUM',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: 'PHONE',
    pattern: 'phone number',
    severity: 'MEDIUM',
    regex: /\b(?:\+?84|0)(?:\d[\s.-]?){8,10}\b/g,
  },
  {
    type: 'NATIONAL_ID',
    pattern: 'national id',
    severity: 'HIGH',
    regex: /\b(?:\d{9}|\d{12})\b/g,
  },
  {
    type: 'KEYWORD',
    pattern: 'secret',
    severity: 'HIGH',
    regex: /\bsecret\b/gi,
  },
  {
    type: 'KEYWORD',
    pattern: 'confidential',
    severity: 'HIGH',
    regex: /\bconfidential\b/gi,
  },
  {
    type: 'KEYWORD',
    pattern: 'internal only',
    severity: 'MEDIUM',
    regex: /\binternal\s+only\b/gi,
  },
];

const MAX_SCAN_CHARS = 1_000_000;
const PDF_MAGIC = '%PDF-';

// pdfjs-dist 4.x ships ESM only. This service compiles with `module: commonjs`,
// which would down-level a normal dynamic import() to require() and break on the
// .mjs entrypoint. Wrapping import in `new Function` hides it from the TS/CJS
// transform so the real ESM dynamic import survives at runtime.
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

@Injectable()
export class DlpScannerService {
  private readonly logger = new Logger(DlpScannerService.name);

  async scan(buffer: Buffer, mimeType?: string): Promise<DlpScanResult> {
    const text = await this.extractText(buffer, mimeType);
    if (text === null) {
      // Unsupported binary type — scanning raw bytes only yields false positives.
      return { status: 'CLEAR', findings: [] };
    }

    const content = text.slice(0, MAX_SCAN_CHARS);
    const findings = RULES.flatMap((rule) => {
      const matches = content.match(rule.regex);
      if (!matches?.length) {
        return [];
      }
      return [
        {
          type: rule.type,
          pattern: rule.pattern,
          severity: rule.severity,
          count: matches.length,
        },
      ];
    });

    if (findings.length === 0) {
      return { status: 'CLEAR', findings: [] };
    }

    return {
      status: 'DETECTED',
      findings,
      suggestedClassification: 'CONFIDENTIAL',
    };
  }

  private async extractText(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<string | null> {
    if (this.isPdf(buffer, mimeType)) {
      return this.extractPdfText(buffer);
    }

    if (this.isTextLike(mimeType)) {
      return buffer.toString('utf8', 0, Math.min(buffer.length, MAX_SCAN_CHARS));
    }

    return null;
  }

  private isPdf(buffer: Buffer, mimeType?: string): boolean {
    if (mimeType === 'application/pdf') {
      return true;
    }
    return buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;
  }

  private isTextLike(mimeType?: string): boolean {
    if (!mimeType) {
      return false;
    }
    if (mimeType.startsWith('text/')) {
      return true;
    }
    return (
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/csv'
    );
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const pdfjs = (await importEsm(
        'pdfjs-dist/legacy/build/pdf.mjs',
      )) as typeof import('pdfjs-dist');

      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: false,
      });
      const pdf = await loadingTask.promise;

      const pageTexts: string[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        pageTexts.push(pageText);

        if (pageTexts.join('\n').length > MAX_SCAN_CHARS) {
          break;
        }
      }

      await pdf.cleanup();
      return pageTexts.join('\n');
    } catch (error) {
      // Extraction must never break uploads — treat a failed parse as empty text.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`PDF text extraction failed for DLP scan: ${message}`);
      return '';
    }
  }
}
