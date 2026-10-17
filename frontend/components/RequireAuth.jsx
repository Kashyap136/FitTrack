'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { EmptyState } from './ui';

/** Blocks a protected page until the stored session has been validated. */
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-9 w-48 rounded-xl skeleton" />
        <div className="card h-64 space-y-3 p-5">
          <div className="h-3 w-1/3 rounded-full skeleton" />
          <div className="h-3 w-2/3 rounded-full skeleton" />
          <div className="h-3 w-1/2 rounded-full skeleton" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to continue"
        description="You need a FitTrack account to log workouts and join challenges."
        action={
          <Link
            href="/login"
            className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            Go to sign in
          </Link>
        }
      />
    );
  }

  return children;
}