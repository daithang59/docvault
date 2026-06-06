import { DemoEvidenceKitPanel } from '@/components/demo/demo-evidence-kit-panel';
import { PageShell } from '@/components/layout/page-shell';
import { buildDemoEvidenceKit } from '@/features/demo/demo-evidence-kit';

export default function DemoKitPage() {
  const model = buildDemoEvidenceKit();

  return (
    <PageShell
      title="Demo Kit"
      description="Runtime web evidence checklist for advisor demo and report screenshots."
    >
      <DemoEvidenceKitPanel model={model} />
    </PageShell>
  );
}
