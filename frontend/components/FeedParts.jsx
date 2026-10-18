'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, Button, FeedCardSkeleton } from './ui';
import { Avatar, UserLink } from './ui/Avatar';
import WorkoutCard from './workout/WorkoutCard';
import { feedApi, statsApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { formatNumber } from '@/lib/format';

function TopAthletes() {
  const { error } = useToast();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await feedApi.people();
        if (!cancelled) setPeople(data.users || []);
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [error]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-full rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {people.slice(0, 6).map((person) => (
        <div key={person.id} className="flex items-center gap-2.5">
          <Avatar name={person.name} handle={person.handle} avatarUrl={person.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <UserLink user={person} className="block truncate text-sm font-medium" />
            <span className="text-xs text-ink-soft">@{person.handle}</span>
          </div>
          <span className="tnum shrink-0 text-xs text-ink-soft">{person.streak}d 🔥</span>
        </div>
      ))}
    </div>
  );
}

function MyStats() {
  const { user } = useAuth();
  const { error } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const data = await statsApi.me();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, error]);

  if (!user) return null;
  if (loading) return <div className="h-20 w-full rounded-xl skeleton" />;
  if (!summary) return null;

  const stats = [
    { label: 'Streak', value: `${summary.streak}d` },
    { label: 'Workouts', value: formatNumber(summary.totalWorkouts) },
    { label: 'This week', value: formatNumber(summary.thisWeekWorkouts) },
    { label: 'PRs', value: formatNumber(summary.prCount) },
  ];

  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2.5 @md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-0 flex-col items-center justify-between gap-1 rounded-xl border border-line bg-surface-sunken p-3"
          >
            <p className="w-full text-center text-xs uppercase leading-tight tracking-wide text-ink-soft">
              {stat.label}
            </p>
            <p className="tnum whitespace-nowrap text-base font-semibold leading-none @md:text-lg">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedList({ refreshToken = 0 }) {
  const { isAuthenticated } = useAuth();
  const { error } = useToast();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (targetPage = 1, append = false) => {
    try {
      const data = await feedApi.list({ page: targetPage, limit: 10 });
      setWorkouts((current) => (append ? [...current, ...data.workouts] : data.workouts));
      setHasMore(data.hasMore);
      setPage(targetPage);
    } catch (err) {
      error(errorMessage(err));
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchFirst() {
      setLoading(true);
      try {
        const data = await feedApi.list({ page: 1, limit: 10 });
        if (cancelled) return;
        setWorkouts(data.workouts || []);
        setHasMore(Boolean(data.hasMore));
        setPage(1);
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchFirst();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, error]);

  const loadMore = async () => {
    setLoadingMore(true);
    await load(page + 1, true);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <FeedCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <EmptyState
        title="No workouts yet"
        description={
          isAuthenticated
            ? 'Log your first workout to start building your fitness history.'
            : 'Join the community and log your first workout.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {workouts.map((workout) => (
        <WorkoutCard key={workout.id} workout={workout} />
      ))}

      {hasMore ? (
        <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="mx-auto">
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  );
}

export function FeedSidebar() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
      <Card className="gap-3">
        <h2 className="text-base font-semibold">Your week</h2>
        <MyStats />
      </Card>
      <Card className="gap-3">
        <h2 className="text-base font-semibold">Top athletes</h2>
        <TopAthletes />
      </Card>
    </aside>
  );
}