'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Layers } from 'lucide-react';
import type { DocumentListItem } from '@/features/documents/documents.types';
import { buildFolderTree, type FolderNode } from '@/features/documents/folder-tree';

interface DocumentFolderTreeProps {
  documents: DocumentListItem[];
  selectedFolder: string;
  onSelect: (folder: string) => void;
}

export function DocumentFolderTree({
  documents,
  selectedFolder,
  onSelect,
}: DocumentFolderTreeProps) {
  const tree = useMemo(() => buildFolderTree(documents), [documents]);

  if (tree.length === 0) {
    return (
      <aside
        className="rounded-lg border p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        aria-label="Folders"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
          <Layers className="h-4 w-4 text-[var(--color-primary)]" />
          Folders
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-faint)]">
          Use slash tags like <code className="font-mono">finance/q1</code> to organize documents into folders.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-lg border p-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      aria-label="Folders"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
          <Layers className="h-4 w-4 text-[var(--color-primary)]" />
          Folders
        </h2>
      </div>

      <button
        type="button"
        onClick={() => onSelect('')}
        className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
        style={{
          background: selectedFolder === '' ? 'var(--bg-muted)' : 'transparent',
          color: 'var(--text-main)',
        }}
      >
        <Folder className="h-4 w-4 text-[var(--text-faint)]" />
        All documents
      </button>

      <ul className="space-y-0.5">
        {tree.map((node) => (
          <FolderTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedFolder={selectedFolder}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </aside>
  );
}

function FolderTreeNode({
  node,
  depth,
  selectedFolder,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  selectedFolder: string;
  onSelect: (folder: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedFolder === node.path;
  const isAncestorOfSelected =
    selectedFolder === node.path || selectedFolder.startsWith(node.path + '/');
  const [expanded, setExpanded] = useState(isAncestorOfSelected);

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded-md pr-2 transition-colors"
        style={{ background: isSelected ? 'var(--bg-muted)' : 'transparent' }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--text-faint)]"
            style={{ marginLeft: depth * 12 }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" style={{ marginLeft: depth * 12 }} />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm text-[var(--text-main)]"
        >
          {expanded && hasChildren ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
          )}
          <span className="truncate">{node.name}</span>
          <span className="ml-auto text-xs text-[var(--text-faint)]">{node.count}</span>
        </button>
      </div>

      {hasChildren && expanded && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
