'use client';

import { useEffect, useState } from 'react';
import { EmptyState, Badge } from '../ui';
import { workoutApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { formatDate, WORKOUT_TYPE_MAP } from '@/lib/format';

export function PRList({ workouts = [] }) {
  if (workouts.length === 0) {
    return (
      <EmptyState
        title="No personal records yet"
        description="Keep training — your first PR will show up here the moment it’s detected."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {workouts.map((workout) => {
        const meta = WORKOUT_TYPE_MAP[workout.type] || { label: workout.type };
        return (
          <article key={workout.id} className="card flex flex-col gap-2.5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={meta.color}>{meta.label}</Badge>
                <Badge tone="pr">PR</Badge>
              </div>
              <time className="text-xs text-ink-soft" title={workout.date}>
                {formatDate(workout.date)}
              </time>
            </div>
            {workout.prHighlights?.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-sm leading-snug">
                {workout.prHighlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            <div className="text-xs text-ink-soft">
              {workout.summary} • {Math.round(workout.calories)} kcal
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PRSection({ limit = 12, refreshToken = 0 }) {
  const { error } = useToast();
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await workoutApi.prs();
        if (cancelled) return;
        setPrs((data.workouts || []).slice(0, limit));
      } catch (err) {
        if (cancelled) return;
        error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [limit, refreshToken, error]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-20 space-y-2 p-4">
            <div className="h-2 w-1/4 rounded-full skeleton" />
            <div className="h-2 w-3/4 rounded-full skeleton" />
            <div className="h-2 w-1/5 rounded-full skeleton" />
          </div>
        ))}
      </div>
    );
  }

  return <PRList workouts={prs} />;
}