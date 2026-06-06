import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearShareToken,
  getShareToken,
  rememberShareToken,
} from './share-token-store';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const g = globalThis as { sessionStorage?: Storage };
let original: Storage | undefined;

beforeEach(() => {
  original = g.sessionStorage;
  g.sessionStorage = new MemoryStorage() as unknown as Storage;
});

afterEach(() => {
  g.sessionStorage = original as Storage;
});

describe('share token store', () => {
  it('remembers and reads a token per document', () => {
    rememberShareToken('doc-1', 'token-abc');
    expect(getShareToken('doc-1')).toBe('token-abc');
    expect(getShareToken('doc-2')).toBeUndefined();
  });

  it('ignores empty doc id or token', () => {
    rememberShareToken('', 'token');
    rememberShareToken('doc-3', '');
    expect(getShareToken('')).toBeUndefined();
    expect(getShareToken('doc-3')).toBeUndefined();
  });

  it('clears a stored token', () => {
    rememberShareToken('doc-1', 'token-abc');
    clearShareToken('doc-1');
    expect(getShareToken('doc-1')).toBeUndefined();
  });
});
