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
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// DOCX is a zip container; its files start with the "PK" local-file-header magic.
const ZIP_MAGIC = 'PK';

// pdfjs-dist 4.x ships ESM only. This service compiles with `module: commonjs`,
// which would down-level a normal dynamic import() to require() and break on the
// .mjs entrypoint. Wrapping import in `new Function` hides it from the TS/CJS
// transform so the real ESM dynamic import survives at runtime.
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

// Pull the visible text out of a DOCX word/document.xml: paragraph and break
// tags become whitespace, <w:t> run contents are kept, all other tags dropped,
// then XML entities are decoded. This keeps phone/email patterns intact while
// discarding markup that would otherwise split or hide them.
function extractDocxXmlText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:(?:br|tab|cr)\b[^>]*\/?>/g, ' ');

  const runs = withBreaks.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
  const text = runs
    .map((run) => run.replace(/<w:t\b[^>]*>/, '').replace(/<\/w:t>/, ''))
    .join(' ');

  return decodeXmlEntities(text);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&');
}

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

    if (this.isDocx(buffer, mimeType)) {
      return this.extractDocxText(buffer);
    }

    if (this.isTextLike(mimeType)) {
      return buffer.toString(
        'utf8',
        0,
        Math.min(buffer.length, MAX_SCAN_CHARS),
      );
    }

    return null;
  }

  private isPdf(buffer: Buffer, mimeType?: string): boolean {
    if (mimeType === 'application/pdf') {
      return true;
    }
    return (
      buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC
    );
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

  private isDocx(buffer: Buffer, mimeType?: string): boolean {
    if (mimeType === DOCX_MIME) {
      return true;
    }
    // A bare ZIP magic is not enough to claim DOCX, so only trust the mimetype
    // here; PDFs and plain text are already handled before this check.
    return false;
  }

  private async extractDocxText(buffer: Buffer): Promise<string> {
    try {
      if (
        buffer.subarray(0, ZIP_MAGIC.length).toString('latin1') !== ZIP_MAGIC
      ) {
        // Mimetype claimed DOCX but the bytes are not a zip container.
        return '';
      }

      // A DOCX is a zip; the body text lives in word/document.xml inside <w:t>
      // runs. We read that entry and strip tags directly rather than going
      // through mammoth, whose DOMParser call is incompatible with the
      // @xmldom/xmldom version pinned in this workspace.
      const JSZip = ((await importEsm('jszip')) as { default: any }).default;
      const zip = await JSZip.loadAsync(buffer);
      const documentEntry = zip.file('word/document.xml');
      if (!documentEntry) {
        return '';
      }

      const xml: string = await documentEntry.async('string');
      return extractDocxXmlText(xml).slice(0, MAX_SCAN_CHARS);
    } catch (error) {
      // Extraction must never break uploads — treat a failed parse as empty text.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`DOCX text extraction failed for DLP scan: ${message}`);
      return '';
    }
  }
}
