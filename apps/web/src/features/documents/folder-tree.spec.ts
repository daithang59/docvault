import { describe, expect, it } from 'vitest';
import { buildFolderTree, documentMatchesFolder } from './folder-tree';
import type { DocumentListItem } from './documents.types';

function doc(id: string, tags: string[]): DocumentListItem {
  return {
    id,
    title: id,
    status: 'PUBLISHED',
    classification: 'INTERNAL',
    ownerId: 'o1',
    currentVersion: 1,
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as DocumentListItem;
}

describe('documentMatchesFolder', () => {
  it('matches an exact folder path', () => {
    expect(documentMatchesFolder(['finance/q1'], 'finance/q1')).toBe(true);
  });

  it('matches a descendant when selecting a parent folder', () => {
    expect(documentMatchesFolder(['finance/q1'], 'finance')).toBe(true);
  });

  it('does not match a sibling with a shared prefix', () => {
    expect(documentMatchesFolder(['financials'], 'finance')).toBe(false);
  });

  it('returns true for an empty folder filter', () => {
    expect(documentMatchesFolder(['anything'], '')).toBe(true);
  });
});

describe('buildFolderTree', () => {
  it('builds nested nodes from slash-style tags', () => {
    const tree = buildFolderTree([
      doc('a', ['finance/q1']),
      doc('b', ['finance/q2']),
      doc('c', ['hr']),
    ]);

    const finance = tree.find((n) => n.path === 'finance');
    expect(finance).toBeDefined();
    expect(finance?.count).toBe(2);
    expect(finance?.children.map((c) => c.path).sort()).toEqual([
      'finance/q1',
      'finance/q2',
    ]);
    // 'hr' has no slash, so it is not a folder node
    expect(tree.find((n) => n.path === 'hr')).toBeUndefined();
  });

  it('counts a document once per ancestor path', () => {
    const tree = buildFolderTree([doc('a', ['finance/q1/reports'])]);
    const finance = tree.find((n) => n.path === 'finance');
    expect(finance?.count).toBe(1);
    expect(finance?.children[0].path).toBe('finance/q1');
    expect(finance?.children[0].children[0].path).toBe('finance/q1/reports');
  });
});
