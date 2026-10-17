'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, EmptyState } from './ui';
import { Avatar } from './ui/Avatar';
import WorkoutForm from './workout/WorkoutForm';
import { FeedList, FeedSidebar } from './FeedParts';
import RequireAuth from './RequireAuth';
import StreakCalendar from './profile/StreakCalendar';
import WeightChart from './profile/WeightChart';
import ShareProfileButton from './profile/ShareProfileButton';
import WeightLogger from './profile/WeightLogger';
import SettingsForm from './settings/SettingsForm';
import { PRList, PRSection } from './profile/PRList';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { statsApi, workoutApi, errorMessage } from '@/lib/api';
import { formatNumber, formatDate, relativeTime, WORKOUT_TYPE_MAP } from '@/lib/format';

/* ---------------------------------------------------------------- /feed */

export function FeedPage() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Community feed</h1>
          <p className="text-sm text-ink-soft">
            Log a workout and see what the community is training.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col gap-6">
            <WorkoutForm onLogged={() => setRefreshToken((token) => token + 1)} />
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Latest workouts</h2>
              <FeedList refreshToken={refreshToken} />
            </section>
          </div>
          <FeedSidebar />
        </div>
      </div>
    </RequireAuth>
  );
}

/* --------------------------------------------------------- /workout/log */

export function LogWorkoutPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [editingWorkout, setEditingWorkout] = useState(null);

  const refresh = () => setRefreshToken((token) => token + 1);

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Log workout</h1>
          <p className="text-sm text-ink-soft">
            Every session is checked against your history for a personal record.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col gap-6">
            <WorkoutForm
              key={editingWorkout ? editingWorkout.id : 'new'}
              compact
              editingWorkout={editingWorkout}
              onCancel={() => setEditingWorkout(null)}
              onLogged={() => {
                setEditingWorkout(null);
                refresh();
              }}
            />
            <MyWorkoutList
              refreshToken={refreshToken}
              onEdit={(workout) => {
                setEditingWorkout(workout);
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleted={refresh}
            />
          </div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="gap-3">
              <h2 className="text-base font-semibold">Personal records</h2>
              <PRSection refreshToken={refreshToken} limit={5} />
            </Card>
          </aside>
        </div>
      </div>
    </RequireAuth>
  );
}

function MyWorkoutList({ refreshToken, onEdit, onDeleted }) {
  const { error, success } = useToast();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (workout) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this workout? This cannot be undone.')) {
      return;
    }
    setDeletingId(workout.id);
    try {
      await workoutApi.remove(workout.id);
      success('Workout deleted');
      if (onDeleted) onDeleted();
    } catch (err) {
      error(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await workoutApi.mine({ limit: 8 });
        if (!cancelled) setWorkouts(data.workouts || []);
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
  }, [refreshToken, error]);

  if (loading) {
    return (
      <Card className="gap-3">
        <h2 className="text-base font-semibold">Recent sessions</h2>
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 w-full rounded-xl skeleton" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <h2 className="text-base font-semibold">Recent sessions</h2>
      {workouts.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No workouts logged yet. Log your first session above to start your history.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {workouts.map((workout) => {
            const meta = WORKOUT_TYPE_MAP[workout.type] || { label: workout.type };
            return (
              <li key={workout.id} className="flex items-center gap-2.5 py-2.5">
                <Badge tone={meta.color}>{meta.label}</Badge>
                <span className="tnum min-w-0 flex-1 truncate text-sm">
                  {workout.summary}
                  <span className="text-ink-soft"> · {Math.round(workout.calories)} kcal</span>
                </span>
                {workout.pr ? <Badge tone="pr">PR</Badge> : null}
                <time className="shrink-0 text-xs text-ink-soft">{relativeTime(workout.date)}</time>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={() => onEdit?.(workout)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-danger hover:bg-danger/10"
                    loading={deletingId === workout.id}
                    onClick={() => handleDelete(workout)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ /profile */

export function ProfilePage({ handle }) {
  const { user } = useAuth();
  const { error } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const targetHandle = handle || user?.handle;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!targetHandle) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      try {
        const response = await statsApi.byHandle(targetHandle);
        if (!cancelled) setData(response);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) setNotFound(true);
        else error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [targetHandle, error, refreshToken]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card h-32 skeleton" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card h-64 skeleton" />
          <div className="card h-64 skeleton" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        title="Profile not found"
        description={`We couldn’t find an athlete with the handle @${targetHandle}.`}
        action={
          <Link href="/feed" className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Back to feed
          </Link>
        }
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Sign in to view your profile"
        description="Create an account to see your own public profile and charts."
        action={
          <Link href="/login" className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Sign in
          </Link>
        }
      />
    );
  }

  const { user: profile, stats, weightHistory, prs, activity, challenges, recentWorkouts } = data;

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <Avatar name={profile.name} handle={profile.handle} avatarUrl={profile.avatarUrl} size="xl" />
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-semibold sm:text-2xl">{profile.name}</h1>
              <p className="text-sm text-ink-soft">@{profile.handle}</p>
              {profile.bio ? <p className="max-w-md text-sm leading-relaxed">{profile.bio}</p> : null}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge tone="pr">{stats.streak} day streak 🔥</Badge>
                {profile.weight ? <Badge>{profile.weight} kg</Badge> : null}
                {profile.location ? <Badge>{profile.location}</Badge> : null}
                {data.isOwner ? <Badge tone="success">This is you</Badge> : null}
              </div>
            </div>
          </div>

          <ShareProfileButton handle={profile.handle} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'Workouts', value: formatNumber(stats.totalWorkouts) },
            { label: 'PRs', value: formatNumber(stats.prCount) },
            { label: 'Distance', value: `${formatNumber(stats.totalDistance, 1)} km` },
            { label: 'Calories', value: formatNumber(stats.totalCalories) },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <h2 className="text-base font-semibold">Weight progression</h2>
          <WeightChart history={weightHistory} />
          {data.isOwner ? (
            <WeightLogger currentWeight={profile.weight} onLogged={() => setRefreshToken((t) => t + 1)} />
          ) : null}
        </Card>

        <Card className="gap-3">
          <h2 className="text-base font-semibold">Activity & streak</h2>
          <StreakCalendar activity={activity} streak={stats.streak} longestStreak={stats.longestStreak} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <h2 className="text-base font-semibold">Personal records</h2>
          <PRList workouts={prs} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <h2 className="text-base font-semibold">Challenges</h2>
            {challenges.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Not part of any challenge yet.{' '}
                <Link href="/challenges" className="font-semibold text-ink underline underline-offset-2">
                  Browse challenges
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {challenges.map((challenge) => {
                  const percent =
                    challenge.goal > 0
                      ? Math.min(100, Math.round((challenge.progress / challenge.goal) * 100))
                      : 0;
                  return (
                    <li key={challenge.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{challenge.name}</span>
                        <span className="tnum shrink-0 text-xs text-ink-soft">
                          {formatNumber(challenge.progress, 1)} / {formatNumber(challenge.goal, 0)}{' '}
                          {challenge.goalUnit}
                        </span>
                      </div>
                      <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="gap-3">
            <h2 className="text-base font-semibold">Recent workouts</h2>
            {recentWorkouts.length === 0 ? (
              <p className="text-sm text-ink-soft">No workouts logged yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentWorkouts.map((workout) => {
                  const meta = WORKOUT_TYPE_MAP[workout.type] || { label: workout.type };
                  return (
                    <li key={workout.id} className="flex items-center gap-2.5 py-2.5">
                      <Badge tone={meta.color}>{meta.label}</Badge>
                      <span className="tnum min-w-0 flex-1 truncate text-sm">{workout.summary}</span>
                      {workout.pr ? <Badge tone="pr">PR</Badge> : null}
                      <time className="shrink-0 text-xs text-ink-soft">
                        {formatDate(workout.date, { year: undefined })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- /settings */

export function SettingsPage() {
  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
          <p className="text-sm text-ink-soft">
            Manage notifications, language, units and your public profile.
          </p>
        </header>
        <SettingsForm />
      </div>
    </RequireAuth>
  );
}
