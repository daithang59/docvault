import { Injectable } from '@nestjs/common';

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

@Injectable()
export class DlpScannerService {
  scan(buffer: Buffer): DlpScanResult {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1_000_000));
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
}
