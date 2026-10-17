'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Surface the failure for debugging without breaking the UI contract.
    console.error('[FitTrack] route error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-ink-soft">
        {error?.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >
        Try again
      </button>
    </div>
  );
}