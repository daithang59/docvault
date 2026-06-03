import type {
  EvidenceBundleManifest,
  EvidenceCaseNarrative,
} from './evidence-center';

export function buildEvidenceReportHtml(
  bundle: EvidenceBundleManifest,
  narrative: EvidenceCaseNarrative,
): string {
  const checklistRows = narrative.checklist
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.complete ? 'Ready' : 'Pending'}</td>
          <td>${item.evidenceCount}</td>
        </tr>`,
    )
    .join('');
  const recommendationRows = narrative.timeline
    .map(
      (item) => `
        <tr>
          <td>${item.sequence}</td>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.severity)}</td>
          <td>${escapeHtml(item.workflowStatus)}</td>
          <td>${escapeHtml(item.packetFilename)}</td>
        </tr>`,
    )
    .join('');
  const documentRows = narrative.documents
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.classification)}</td>
          <td>${escapeHtml(item.retentionStatus)}</td>
          <td>${escapeHtml(item.packetFilename)}</td>
        </tr>`,
    )
    .join('');
  const warningItems = [...narrative.blockers, ...narrative.warnings]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(narrative.caseId)} Evidence Report</title>
    <style>
      :root {
        color: #172033;
        background: #f6f8fb;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
      }
      main {
        max-width: 1040px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #d8dee9;
        border-radius: 8px;
        padding: 28px;
      }
      h1, h2 {
        margin: 0;
      }
      h1 {
        font-size: 24px;
      }
      h2 {
        margin-top: 28px;
        font-size: 16px;
      }
      p {
        line-height: 1.55;
      }
      .meta {
        color: #526070;
        font-size: 13px;
      }
      .pill {
        display: inline-block;
        border: 1px solid #c5cfdd;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .metric {
        border: 1px solid #d8dee9;
        border-radius: 8px;
        padding: 12px;
      }
      .metric span {
        display: block;
        color: #526070;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .metric strong {
        display: block;
        margin-top: 6px;
        font-size: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #d8dee9;
        padding: 9px 10px;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }
      th {
        background: #eef2f7;
      }
      ul {
        margin: 10px 0 0;
        padding-left: 22px;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        main {
          border: 0;
          border-radius: 0;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <span class="pill">${escapeHtml(narrative.status)}</span>
      <h1>${escapeHtml(narrative.caseId)}</h1>
      <p class="meta">Metadata-only report generated at ${escapeHtml(
        narrative.generatedAt,
      )}</p>
      <p>${escapeHtml(narrative.headline)}</p>

      <section class="grid">
        <div class="metric"><span>Total packets</span><strong>${bundle.summary.totalPackets}</strong></div>
        <div class="metric"><span>Recommendations</span><strong>${bundle.summary.recommendationPackets}</strong></div>
        <div class="metric"><span>Documents</span><strong>${bundle.summary.documentPackets}</strong></div>
        <div class="metric"><span>Audit events</span><strong>${narrative.auditChain.checkedEvents}</strong></div>
      </section>

      <h2>Evidence Controls</h2>
      <p>${escapeHtml(narrative.auditChain.label)}. ${escapeHtml(
        narrative.retentionPosture.label,
      )}.</p>
      <p class="meta">Excluded sensitive fields: ${bundle.excludedSensitiveFields
        .map(escapeHtml)
        .join(', ')}</p>

      ${
        warningItems
          ? `<h2>Readiness Notes</h2><ul>${warningItems}</ul>`
          : ''
      }

      <h2>Checklist</h2>
      <table>
        <thead><tr><th>Item</th><th>Status</th><th>Evidence count</th></tr></thead>
        <tbody>${checklistRows}</tbody>
      </table>

      <h2>Recommendation Packets</h2>
      <table>
        <thead><tr><th>#</th><th>Title</th><th>Severity</th><th>Workflow</th><th>Packet filename</th></tr></thead>
        <tbody>${recommendationRows || '<tr><td colspan="5">No recommendation packet selected.</td></tr>'}</tbody>
      </table>

      <h2>Document Packets</h2>
      <table>
        <thead><tr><th>Title</th><th>Classification</th><th>Retention</th><th>Packet filename</th></tr></thead>
        <tbody>${documentRows || '<tr><td colspan="4">No document packet selected.</td></tr>'}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
