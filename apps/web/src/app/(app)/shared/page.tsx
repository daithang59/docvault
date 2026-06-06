'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { redeemShareLink } from '@/features/share-links/share-links.api';
import { getErrorMessage } from '@/lib/api/errors';
import { ROUTES } from '@/lib/constants/routes';
import { LoadingState } from '@/components/common/loading-state';

export default function SharedRedeemPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    redeemShareLink(token)
      .then((res) => {
        if (!cancelled) router.replace(ROUTES.DOCUMENT_DETAIL(res.docId));
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const message = !token
    ? 'This share link is missing its token.'
    : error;

  if (message) {
    return (
      <div
        className="mx-auto max-w-md rounded-lg border p-6 text-center"
        style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-card)' }}
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="text-base font-semibold text-[var(--text-strong)]">
          Share link unavailable
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
      </div>
    );
  }

  return <LoadingState label="Opening shared document..." />;
}
