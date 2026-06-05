import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

describe('production start contract', () => {
  it('uses the standalone server entrypoint when standalone output is enabled', () => {
    const nextConfig = readProjectFile('next.config.ts');
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(nextConfig).toContain("output: 'standalone'");
    expect(packageJson.scripts?.start).toBe('node scripts/start-standalone.mjs');
    expect(packageJson.scripts?.start).not.toContain('next start');
  });
});
