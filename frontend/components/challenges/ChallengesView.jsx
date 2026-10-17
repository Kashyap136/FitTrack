'use client';

import { useState } from 'react';
import ChallengeGrid from './ChallengeGrid';
import CreateChallengeForm from './CreateChallengeForm';

/** Challenges route body: create form + filterable grid, refreshed on create. */
export default function ChallengesView() {
  const [token, setToken] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Challenges</h1>
          <p className="text-sm text-ink-soft">
            Train together, track your progress and top the leaderboard.
          </p>
        </div>
        <CreateChallengeForm onCreated={() => setToken((value) => value + 1)} />
      </header>

      <ChallengeGrid key={token} />
    </div>
  );
}