'use client';

import Link from 'next/link';
import { Card } from './ui';
import { Avatar } from './ui/Avatar';
import { FeedList, FeedSidebar } from './FeedParts';
import { PRSection } from './profile/PRList';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { statsApi, errorMessage } from '@/lib/api';
import { useEffect, useState } from 'react';
import { formatDuration, formatNumber } from '@/lib/format';

const DESTINATIONS = [
  {
    href: '/workout/log',
    title: 'Log workout',
    body: 'Record a run, lift or flow. We check it against your history for a new PR.',
  },
  {
    href: '/feed',
    title: 'Community feed',
    body: 'See what the community trained today, like and comment on sessions.',
  },
  {
    href: '/challenges',
    title: 'Explore challenges',
    body: 'Running, plank and yoga goals with live progress bars.',
  },
  {
    href: '/leaderboard',
    title: 'View leaderboard',
    body: 'Progress-ranked standings for every challenge you have joined.',
  },
];

function Landing() {
  return (
    <div className="flex flex-col gap-8">
      <section className="card flex flex-col gap-5 p-6 sm:p-8">
        <span className="inline-flex w-fit rounded-full border border-line bg-surface-sunken px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Community fitness tracking
        </span>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
          Log the work. Beat your best. Share the streak.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          FitTrack Community is a training log with a social pulse: real personal-record
          detection, streak calendars, weight tracking, and challenges with live leaderboards.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/register"
            className="rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DESTINATIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card flex flex-col gap-2 p-5 transition hover:border-ink"
          >
            <h2 className="text-base font-semibold">{item.title}</h2>
            <p className="text-sm leading-relaxed text-ink-soft">{item.body}</p>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Community</h2>
        <p className="-mt-2 text-sm text-ink-soft">
          Browse public profiles and progress without an account.
        </p>
        <div className="flex flex-wrap gap-2">
          {['aaravfit', 'priyafit', 'rohanruns', 'ananyayoga'].map((handle) => (
            <Link
              key={handle}
              href={`/profile/${handle}`}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition hover:bg-surface-sunken hover:text-ink"
            >
              @{handle}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { error } = useToast();
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await statsApi.me();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} handle={user?.handle} avatarUrl={user?.avatarUrl} size="lg" />
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">
                Hey {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-ink-soft">
                {summary && summary.streak > 0
                  ? `You’re on a ${summary.streak} day streak — keep it alive today.`
                  : 'Log a workout today to start a streak.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/workout/log"
              className="rounded-2xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink"
            >
              Log workout
            </Link>
            <Link
              href={`/profile/${user?.handle}`}
              className="rounded-2xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold"
            >
              My profile
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {loadingSummary
            ? [...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)
            : [
                { label: 'Streak', value: `${summary?.streak ?? 0} days` },
                { label: 'This week', value: `${summary?.thisWeekWorkouts ?? 0} workouts` },
                { label: 'Time this week', value: formatDuration(summary?.thisWeekMinutes) },
                { label: 'PRs', value: formatNumber(summary?.prCount ?? 0) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-line bg-surface-sunken p-3 min-w-[72px] sm:min-w-0 flex flex-col items-center gap-1"
                >
                  <p className="text-xs uppercase tracking-wide text-ink-soft leading-tight text-center w-full">
                    {stat.label}
                  </p>
                  <p className="tnum text-base font-semibold sm:text-lg leading-none whitespace-nowrap">
                    {stat.value}
                  </p>
                </div>
              ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Community feed</h2>
            <Link href="/feed" className="text-sm font-medium text-ink-soft hover:text-ink">
              Open feed →
            </Link>
          </div>
          <FeedList />
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <h2 className="text-base font-semibold">Your PRs</h2>
            <PRSection limit={4} />
          </Card>
          <FeedSidebar />
        </div>
      </div>
    </div>
  );
}

/** `/` serves the dashboard to signed-in athletes and the landing page to guests. */
export default function HomeView() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card h-40 skeleton" />
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <Landing />;
}