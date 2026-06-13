import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentAiGuardrailsCard } from './document-ai-guardrails-card';
import type { DocumentAiGuardrails } from '@/features/documents/documents.types';

const blockedGuardrails: DocumentAiGuardrails = {
  documentId: 'doc-1',
  actorId: 'co-1',
  classification: 'SECRET',
  status: 'PUBLISHED',
  canUseMetadata: true,
  canUseContent: false,
  allowedOperations: ['METADATA_CLASSIFICATION', 'METADATA_TAGGING'],
  deniedOperations: [
    {
      operation: 'CONTENT_SUMMARIZATION',
      reason: 'Compliance officers cannot use file content for AI operations',
    },
    {
      operation: 'CONTENT_QA',
      reason: 'Compliance officers cannot use file content for AI operations',
    },
  ],
  guardrails: [
    'Use metadata policy before building AI context',
    'Never include file content when canUseContent is false',
  ],
};

describe('DocumentAiGuardrailsCard', () => {
  it('shows metadata-only AI access and blocked content operations', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentAiGuardrailsCard, {
        guardrails: blockedGuardrails,
      }),
    );

    expect(html).toContain('AI guardrails');
    expect(html).toContain('Metadata only');
    expect(html).toContain('Metadata classification');
    expect(html).toContain('Content summarization');
    expect(html).toContain('Compliance officers cannot use file content for AI operations');
  });
});
