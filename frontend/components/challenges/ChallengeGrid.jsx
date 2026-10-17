'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Badge } from '../ui';
import { challengeApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { formatDate, formatChallengeProgress, CHALLENGE_TYPE_MAP } from '@/lib/format';
import Link from 'next/link';

function ChallengeCard({ challenge, onJoined }) {
  const { success, error } = useToast();
  const [joining, setJoining] = useState(false);
  const meta = CHALLENGE_TYPE_MAP[challenge.type] || { label: challenge.type };

  // Members see their own contribution against the goal; guests see the
  // leading athlete so an active challenge never looks empty.
  const leader = challenge.members?.[0];
  const shownProgress = challenge.joined ? challenge.myProgress || 0 : leader?.progress || 0;
  const progressPercent =
    challenge.goal > 0 ? Math.min(100, Math.round((shownProgress / challenge.goal) * 100)) : 0;

  const statusTone = {
    active: 'success',
    upcoming: 'neutral',
    ended: 'neutral',
  }[challenge.status];

  const handleJoin = async () => {
    setJoining(true);
    try {
      const data = await challengeApi.join(challenge.id);
      success(data.message || 'Joined challenge');
      if (onJoined) onJoined(data.challenge);
    } catch (err) {
      error(errorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  return (
    <article className="card flex h-full flex-col gap-4 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold sm:text-lg">{challenge.name}</h3>
          {challenge.description ? (
            <p className="text-sm leading-relaxed text-ink-soft line-clamp-3">{challenge.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.color || 'neutral'}>{meta.label}</Badge>
          <Badge tone={statusTone}>{challenge.status}</Badge>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-medium">
            {formatChallengeProgress(shownProgress, challenge.goal, challenge.goalUnit)}
          </span>
          <span className="shrink-0 text-xs text-ink-soft">
            {Math.round(progressPercent)}% • {challenge.memberCount} member
            {challenge.memberCount === 1 ? '' : 's'}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={challenge.goal || 100}
          aria-valuenow={Math.round(shownProgress)}
          aria-label={`${challenge.joined ? 'Your' : 'Leading'} progress`}
        >
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-ink-soft">
          {challenge.joined
            ? `Your progress${challenge.myRank ? ` • rank #${challenge.myRank}` : ''}`
            : leader?.user?.handle
              ? `Leading: @${leader.user.handle}`
              : 'No members yet — be the first to log progress.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft sm:text-sm">
        <span>
          {formatDate(challenge.startDate)} — {formatDate(challenge.endDate)}
        </span>
        {challenge.daysLeft >= 0 && challenge.status === 'active' ? (
          <span>{challenge.daysLeft} day{challenge.daysLeft === 1 ? '' : 's'} left</span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <Link
          href={`/leaderboard?challengeId=${challenge.id}`}
          className="text-sm font-medium text-ink-soft hover:text-ink"
        >
          View leaderboard →
        </Link>
        {challenge.joined ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/leaderboard?challengeId=${challenge.id}`}>Track progress</Link>
          </Button>
        ) : challenge.status === 'ended' ? (
          <Button variant="secondary" size="sm" disabled title="This challenge has ended">
            Challenge ended
          </Button>
        ) : (
          <Button size="sm" loading={joining} onClick={handleJoin} disabled={joining}>
            Join challenge
          </Button>
        )}
      </div>
    </article>
  );
}

export default function ChallengeGrid({ initialStatus = 'active', showHeader = true }) {
  const [challenges, setChallenges] = useState([]);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await challengeApi.list({ status });
        if (cancelled) return;
        setChallenges(data.challenges || []);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleJoined = (challenge) => {
    setChallenges((current) =>
      current.map((c) => (c.id === challenge.id ? { ...c, ...challenge } : c))
    );
  };

  const statuses = useMemo(
    () => [
      { key: 'active', label: 'Active' },
      { key: 'upcoming', label: 'Upcoming' },
      { key: 'ended', label: 'Ended' },
      { key: 'all', label: 'All' },
    ],
    []
  );

  return (
    <section className="flex flex-col gap-4">
      {showHeader && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold sm:text-xl">Challenges</h2>
            <p className="text-sm text-ink-soft">Join a challenge and move up the leaderboard.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface p-1">
            {statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(s.key)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  status === s.key ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:bg-surface-sunken'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-48 space-y-3 p-4">
              <div className="h-2.5 w-2/3 rounded-full skeleton" />
              <div className="h-2 w-1/2 rounded-full skeleton" />
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded-full skeleton" />
                <div className="h-2 w-4/5 rounded-full skeleton" />
              </div>
              <div className="mt-auto flex justify-between">
                <div className="h-8 w-20 rounded-2xl skeleton" />
                <div className="h-8 w-24 rounded-2xl skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn’t load challenges" description={error} />
      ) : challenges.length === 0 ? (
        <EmptyState
          title="No challenges yet"
          description="Create one from the feed or check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} onJoined={handleJoined} />
          ))}
        </div>
      )}
    </section>
  );
}