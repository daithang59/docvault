import {
  resolveActorIdsInText,
  type EvidenceBundleManifest,
  type EvidenceCaseNarrative,
  type UserDisplayNameMap,
} from './evidence-center';

export function buildEvidenceReportHtml(
  bundle: EvidenceBundleManifest,
  narrative: EvidenceCaseNarrative,
  actorDisplayNames?: UserDisplayNameMap,
): string {
  const sectionCards = narrative.sections
    .map(
      (section) => `
        <article class="section-card">
          <div>
            <span class="state">${escapeHtml(section.state)}</span>
            <h3>${escapeHtml(section.label)}</h3>
          </div>
          <p>${escapeHtml(section.summary)}</p>
          <dl>
            ${section.items
              .map(
                (item) => `
                  <div>
                    <dt>${escapeHtml(item.label)}</dt>
                    <dd>${escapeHtml(item.value)}</dd>
                  </div>`,
              )
              .join('')}
          </dl>
        </article>`,
    )
    .join('');
  const timelineItems = narrative.visualTimeline
    .map(
      (item) => `
        <li>
          <span class="step">${item.sequence}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.description)}</p>
          </div>
        </li>`,
    )
    .join('');
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
          <td>${escapeHtml(resolveActorIdsInText(item.title, item.affectedActorIds, actorDisplayNames))}</td>
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
      .section-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .metric {
        border: 1px solid #d8dee9;
        border-radius: 8px;
        padding: 12px;
      }
      .section-card {
        border: 1px solid #d8dee9;
        border-radius: 8px;
        padding: 14px;
        break-inside: avoid;
      }
      .section-card h3 {
        margin: 6px 0 0;
        font-size: 15px;
      }
      .section-card p {
        margin: 8px 0 0;
        color: #526070;
        font-size: 13px;
      }
      .section-card dl {
        margin: 12px 0 0;
      }
      .section-card dl div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-top: 1px solid #e5e9f0;
        padding: 8px 0;
      }
      .section-card dt {
        color: #526070;
        font-size: 12px;
      }
      .section-card dd {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }
      .state {
        color: #526070;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
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
      .timeline {
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
      }
      .timeline li {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 10px;
        padding: 0 0 14px;
      }
      .timeline li + li {
        border-top: 1px solid #e5e9f0;
        padding-top: 14px;
      }
      .timeline .step {
        display: inline-flex;
        width: 28px;
        height: 28px;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #172033;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
      }
      .timeline strong {
        display: block;
        font-size: 13px;
      }
      .timeline p {
        margin: 4px 0 0;
        color: #526070;
        font-size: 13px;
      }
      @media (max-width: 720px) {
        body {
          padding: 16px;
        }
        .grid,
        .section-grid {
          grid-template-columns: 1fr;
        }
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
      <p><strong>${escapeHtml(narrative.integrityBadge.label)}</strong> - ${escapeHtml(
        narrative.integrityBadge.detail,
      )}</p>

      <section class="grid">
        <div class="metric"><span>Total packets</span><strong>${bundle.summary.totalPackets}</strong></div>
        <div class="metric"><span>Recommendations</span><strong>${bundle.summary.recommendationPackets}</strong></div>
        <div class="metric"><span>Documents</span><strong>${bundle.summary.documentPackets}</strong></div>
        <div class="metric"><span>Audit events</span><strong>${narrative.auditChain.checkedEvents}</strong></div>
      </section>

      <h2>Evidence Packet Sections</h2>
      <section class="section-grid">${sectionCards}</section>

      <h2>Visual Timeline</h2>
      <ol class="timeline">${timelineItems}</ol>

      <h2>Evidence Controls</h2>
      <p>${escapeHtml(narrative.integrityBadge.label)}. ${escapeHtml(
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
