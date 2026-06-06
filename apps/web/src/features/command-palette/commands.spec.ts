import { describe, expect, it } from 'vitest';
import { buildCommandItems, filterCommands } from './commands';

describe('buildCommandItems', () => {
  it('includes navigation and actions scoped to admin', () => {
    const items = buildCommandItems(['admin']);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('nav-/dashboard');
    expect(ids).toContain('action-new-document');
    expect(items.every((i) => i.roles.some((r) => ['admin'].includes(r)))).toBe(
      true,
    );
  });

  it('excludes commands a viewer cannot access', () => {
    const items = buildCommandItems(['viewer']);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('nav-/dashboard');
    expect(ids).not.toContain('action-new-document');
    expect(ids).not.toContain('nav-/audit');
  });
});

describe('filterCommands', () => {
  const commands = buildCommandItems(['admin']);

  it('returns all commands for an empty query', () => {
    expect(filterCommands(commands, '   ')).toEqual(commands);
  });

  it('ranks title prefix matches above keyword matches', () => {
    const results = filterCommands(commands, 'doc');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase().startsWith('doc')).toBe(true);
  });

  it('matches on keywords beyond the title', () => {
    const results = filterCommands(commands, 'recertify');
    expect(results.map((r) => r.id)).toContain('action-access-review');
  });

  it('returns empty when nothing matches', () => {
    expect(filterCommands(commands, 'zzzzz')).toEqual([]);
  });
});
