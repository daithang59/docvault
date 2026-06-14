import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ColumnBarChart,
  PriorityBarList,
  ScoreGauge,
  SegmentDonut,
} from './analytics-primitives';

const segments = [
  {
    key: 'critical',
    label: 'Critical',
    value: 2,
    percentage: 67,
    tone: 'critical' as const,
    href: '/security',
  },
  {
    key: 'warning',
    label: 'Warning',
    value: 1,
    percentage: 33,
    tone: 'warning' as const,
    href: '/approvals',
  },
];

describe('analytics primitives', () => {
  it('renders an accessible score gauge with visible value and label', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ScoreGauge, {
        label: 'Evidence readiness',
        value: 75,
        tone: 'success',
        description: 'Evidence sources are mostly linked.',
        href: '/evidence',
      }),
    );

    expect(markup).toContain('Evidence readiness');
    expect(markup).toContain('75%');
    expect(markup).toContain('aria-label="Evidence readiness score 75 percent"');
    expect(markup).toContain('href="/evidence"');
  });

  it('renders a labelled segmented donut from segment data', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SegmentDonut, {
        label: 'Attention by priority',
        segments,
      }),
    );

    expect(markup).toContain('Attention by priority');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('Critical 2');
    expect(markup).toContain('Warning 1');
  });

  it('renders a priority bar list with labels, values, and percentages', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PriorityBarList, {
        label: 'Priority distribution',
        segments,
      }),
    );

    expect(markup).toContain('Priority distribution');
    expect(markup).toContain('Critical');
    expect(markup).toContain('2');
    expect(markup).toContain('67%');
    expect(markup).toContain('Warning');
    expect(markup).toContain('33%');
  });

  it('renders an accessible column bar chart for compact dashboard distributions', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ColumnBarChart, {
        label: 'Lifecycle pipeline',
        segments,
      }),
    );

    expect(markup).toContain('Lifecycle pipeline');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('Critical 2');
    expect(markup).toContain('Warning 1');
    expect(markup).toContain('67%');
    expect(markup).toContain('33%');
  });
});
