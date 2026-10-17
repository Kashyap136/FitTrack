'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LeaderboardTable from './LeaderboardTable';
import RequireAuth from '../RequireAuth';

/**
 * Leaderboard route body. Reads `?challengeId=` so challenge cards can deep-link
 * into a specific board. Rendered inside a Suspense boundary by the route.
 */
export default function LeaderboardView() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('challengeId');

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Leaderboard</h1>
          <p className="text-sm text-ink-soft">
            Progress-ranked standings for every challenge you’ve joined. Tap an athlete to open
            their profile.
          </p>
        </header>

        {preselectedId ? (
          <p className="text-sm text-ink-soft">
            Showing the challenge you came from.{' '}
            <Link href="/leaderboard" className="font-semibold text-ink underline underline-offset-2">
              Show all my challenges
            </Link>
          </p>
        ) : null}

        <LeaderboardTable preselectedId={preselectedId} />
      </div>
    </RequireAuth>
  );
}