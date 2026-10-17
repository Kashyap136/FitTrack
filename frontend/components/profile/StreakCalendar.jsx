'use client';

import { useMemo } from 'react';

/**
 * Activity heat-calendar built from real workout dates returned by the API
 * (GET /api/stats/:handle → `activity`). Nothing here is randomised.
 */
export default function StreakCalendar({ activity = {}, streak = 0, longestStreak = 0 }) {
  const days = useMemo(() => Object.values(activity).sort((a, b) => a.date.localeCompare(b.date)), [activity]);

  const intensity = (count) => {
    if (count <= 0) return 'bg-surface-sunken';
    if (count === 1) return 'bg-[#e9f7b0]';
    if (count === 2) return 'bg-[#d7f24b]';
    return 'bg-accent-deep';
  };

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-sunken p-6 text-center">
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs text-ink-soft">Log a workout to start your streak calendar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span>
          Current streak:{' '}
          <strong className="tnum text-ink">{streak} day{streak === 1 ? '' : 's'}</strong>
        </span>
        <span>
          Longest: <strong className="tnum text-ink">{longestStreak} days</strong>
        </span>
      </div>

      <div
        className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1"
        role="img"
        aria-label={`Activity calendar: ${days.filter((d) => d.count > 0).length} active days out of ${days.length}`}
      >
        {days.map((day) => (
          <span
            key={day.date}
            title={`${day.date}: ${day.count} workout${day.count === 1 ? '' : 's'}`}
            className={`h-3.5 w-3.5 rounded-[4px] sm:h-4 sm:w-4 ${intensity(day.count)} ${
              day.isToday ? 'ring-2 ring-ink ring-offset-1' : ''
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink-faint">
        <span>Less</span>
        {['bg-surface-sunken', 'bg-[#e9f7b0]', 'bg-[#d7f24b]', 'bg-accent-deep'].map((tone) => (
          <span key={tone} className={`h-3 w-3 rounded-[4px] ${tone}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}