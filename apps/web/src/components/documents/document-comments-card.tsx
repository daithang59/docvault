'use client';

import { useState } from 'react';
import { useComments, useAddComment } from '@/lib/hooks/use-comments';
import { formatOwnerName } from '@/lib/utils/format';
import { formatDateTime } from '@/lib/utils/date';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentCommentsCardProps {
  docId: string;
}

export function DocumentCommentsCard({ docId }: DocumentCommentsCardProps) {
  const { data: comments = [], isLoading } = useComments(docId);
  const addComment = useAddComment(docId);
  const [text, setText] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    try {
      await addComment.mutateAsync(content);
      setText('');
    } catch {
      toast.error('Failed to add comment.');
    }
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--card-surface-bg)',
        borderColor: 'var(--border-soft)',
        boxShadow: 'var(--card-surface-shadow)',
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-main)]">
          Comments
          {comments.length > 0 && (
            <span className="ml-1.5 text-[var(--text-muted)] font-normal">({comments.length})</span>
          )}
        </h3>
      </div>

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
          disabled={addComment.isPending}
        />
        <button
          type="submit"
          disabled={!text.trim() || addComment.isPending}
          className="rounded-xl px-3 py-2 transition-all btn-primary text-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--bg-muted)]" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-xs text-[var(--text-faint)] py-4">No comments yet.</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border px-3 py-2.5 transition-colors"
              style={{
                background: 'var(--bg-muted)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-primary)]">
                  {formatOwnerName(c.authorId)}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  {formatDateTime(c.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap break-words">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
