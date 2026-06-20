import type { DocumentListItem } from './documents.types';

export interface FolderNode {
  name: string;
  path: string;
  count: number;
  children: FolderNode[];
}

/**
 * Whether a document tag belongs to a folder path. Folder paths are slash-style
 * tags like "finance/q1". A document matches a folder when one of its tags is
 * exactly that path or a descendant of it (segment boundary), so selecting
 * "finance" also includes "finance/q1".
 */
export function documentMatchesFolder(tags: string[], folder: string): boolean {
  if (!folder) return true;
  return (tags ?? []).some(
    (tag) => tag === folder || tag.startsWith(folder + '/'),
  );
}

/**
 * Build a folder tree from slash-style tags across the document set. Each node
 * carries the count of documents that have a tag at or below that path.
 */
export function buildFolderTree(documents: DocumentListItem[]): FolderNode[] {
  const roots: FolderNode[] = [];
  const byPath = new Map<string, FolderNode>();

  function ensureNode(path: string): FolderNode {
    const existing = byPath.get(path);
    if (existing) return existing;
    const segments = path.split('/');
    const name = segments[segments.length - 1];
    const node: FolderNode = { name, path, count: 0, children: [] };
    byPath.set(path, node);
    if (segments.length === 1) {
      roots.push(node);
    } else {
      const parentPath = segments.slice(0, -1).join('/');
      ensureNode(parentPath).children.push(node);
    }
    return node;
  }

  for (const document of documents) {
    const folderTags = (document.tags ?? []).filter((tag) => tag.includes('/'));
    // Each document contributes once to every ancestor path it touches.
    const touched = new Set<string>();
    for (const tag of folderTags) {
      const segments = tag.split('/').filter(Boolean);
      for (let i = 1; i <= segments.length; i++) {
        touched.add(segments.slice(0, i).join('/'));
      }
    }
    for (const path of touched) {
      ensureNode(path).count += 1;
    }
  }

  const sortTree = (nodes: FolderNode[]): FolderNode[] => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    for (const node of nodes) sortTree(node.children);
    return nodes;
  };

  return sortTree(roots);
}
