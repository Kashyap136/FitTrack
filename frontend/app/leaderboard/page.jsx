import { Suspense } from 'react';
import LeaderboardView from '@/components/leaderboard/LeaderboardView';

export const metadata = {
  title: 'Leaderboard',
};

function LeaderboardFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 w-48 rounded-xl skeleton" />
      <div className="flex flex-col gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 w-full rounded-xl skeleton" />
        ))}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardView />
    </Suspense>
  );
}