/** Presentation helpers shared across pages (dates, numbers, labels). */

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function formatShortDate(value) {
  return formatDate(value, { year: undefined });
}

export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** "3 hours ago" / "2 days ago" — used on feed cards. */
export function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    const amount = Math.floor(Math.abs(diffSeconds) / seconds);
    if (amount >= 1) {
      const label = `${amount} ${unit}${amount > 1 ? 's' : ''}`;
      return diffSeconds >= 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return 'just now';
}

/** Value for `<input type="datetime-local">` in the viewer's timezone. */
export function toDateTimeLocalValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function initials(name = '', handle = '') {
  const source = (name || handle || '?').trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '?';
}

export const WORKOUT_TYPES = [
  {
    type: 'run',
    label: 'Run',
    color: 'run',
    accent: 'var(--color-run)',
    blurb: 'Distance and duration',
  },
  {
    type: 'gym',
    label: 'Gym',
    color: 'gym',
    accent: 'var(--color-gym)',
    blurb: 'Sets, reps and load',
  },
  {
    type: 'yoga',
    label: 'Yoga',
    color: 'yoga',
    accent: 'var(--color-yoga)',
    blurb: 'Duration and holds',
  },
];

export const WORKOUT_TYPE_MAP = WORKOUT_TYPES.reduce((acc, entry) => {
  acc[entry.type] = entry;
  return acc;
}, {});

export const CHALLENGE_TYPES = [
  { type: 'run', label: 'Running', unit: 'km', color: 'run', accent: 'var(--color-run)' },
  { type: 'plank', label: 'Plank', unit: 'seconds', color: 'gym', accent: 'var(--color-gym)' },
  { type: 'yoga', label: 'Yoga', unit: 'minutes', color: 'yoga', accent: 'var(--color-yoga)' },
  { type: 'gym', label: 'Gym', unit: 'sets', color: 'gym', accent: 'var(--color-gym)' },
];

export const CHALLENGE_TYPE_MAP = CHALLENGE_TYPES.reduce((acc, entry) => {
  acc[entry.type] = entry;
  return acc;
}, {});

export const CHALLENGE_UNIT_LABEL = {
  km: 'km',
  seconds: 'sec',
  minutes: 'min',
  sets: 'sets',
  workouts: 'workouts',
};

/** 340 -> "5h 40m", 45 -> "45m" */
export function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  if (total <= 0) return '0m';
  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatChallengeProgress(progress = 0, goal = 0, unit = '') {
  const decimals = Number.isInteger(Number(progress)) && Number(progress) < 100 ? 1 : 0;
  const value = Number(progress) || 0;
  const pretty = value >= 60 ? Math.round(value) : value;
  return `${formatNumber(pretty, decimals)}${unit ? ` ${unit}` : ''} / ${formatNumber(goal)}${
    unit ? ` ${unit}` : ''
  }`;
}

/** Deterministic accent colour derived from a handle (avoids random values). */
export function avatarPalette(seed = '') {
  const palettes = [
    ['#111310', '#d7f24b'],
    ['#2f6bff', '#e7efff'],
    ['#ff5a3c', '#ffeee9'],
    ['#7c5cff', '#f0ecff'],
    ['#12805c', '#e4f6ee'],
    ['#b6d21f', '#f6fbdd'],
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return palettes[hash % palettes.length];
}