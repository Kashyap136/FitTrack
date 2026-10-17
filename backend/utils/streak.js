/**
 * Streak maths. A streak is a run of consecutive calendar days that contain at
 * least one logged workout. Everything is derived from stored workout dates so
 * no streak value is ever hardcoded.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time day key (YYYY-MM-DD) so streaks follow the user's calendar. */
function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function differenceInDays(later, earlier) {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

/** Sorted unique day keys for the supplied workout dates. */
function activeDayKeys(dates) {
  return [...new Set(dates.map((d) => dayKey(d)))].sort();
}

/**
 * Current + longest streak from a list of workout dates.
 * Today without a workout does not break a streak — yesterday still counts,
 * which keeps a live streak alive until the day is actually missed.
 */
function calculateStreaks(dates, now = new Date()) {
  const keys = activeDayKeys(dates);
  if (keys.length === 0) return { current: 0, longest: 0, activeDays: keys };

  const keyToDate = new Map(keys.map((key) => [key, startOfDay(new Date(`${key}T00:00:00`))]));

  let longest = 0;
  let running = 0;
  let previous = null;

  keys.forEach((key) => {
    const current = keyToDate.get(key);
    running = previous && differenceInDays(current, previous) === 1 ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = current;
  });

  const today = startOfDay(now);
  // Future-dated sessions (allowed up to +24h) must not reset a live streak, so
  // the current streak is measured from the latest day on or before today.
  const pastKeys = keys.filter((key) => keyToDate.get(key).getTime() <= today.getTime());
  const lastActive = pastKeys.length ? keyToDate.get(pastKeys[pastKeys.length - 1]) : null;
  const daysSinceLast = lastActive ? differenceInDays(today, lastActive) : Infinity;
  let current = 0;
  if (daysSinceLast === 0 || daysSinceLast === 1) {
    current = 1;
    let cursor = lastActive;
    while (keyToDate.has(dayKey(addDays(cursor, -1)))) {
      cursor = addDays(cursor, -1);
      current += 1;
    }
  }

  return { current, longest: Math.max(longest, current), activeDays: keys };
}

/**
 * Per-day activity map for the last `days` days, used by the streak calendar.
 */
function buildActivityMap(dates, days = 84, now = new Date()) {
  const counts = new Map();
  dates.forEach((date) => {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const map = {};
  const today = startOfDay(now);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const key = dayKey(day);
    map[key] = {
      date: key,
      count: counts.get(key) || 0,
      isToday: offset === 0,
      isFuture: false,
    };
  }
  return map;
}

module.exports = {
  DAY_MS,
  addDays,
  buildActivityMap,
  calculateStreaks,
  dayKey,
  differenceInDays,
  startOfDay,
};