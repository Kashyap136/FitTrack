'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '../ui';
import { Avatar, UserLink } from '../ui/Avatar';
import { leaderboardApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { formatNumber, CHALLENGE_TYPE_MAP } from '@/lib/format';

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 w-full rounded-xl skeleton" />
      ))}
    </div>
  );
}

/**
 * Leaderboard table.
 *  - `md` and up: semantic <table>
 *  - below `md`: stacked cards (no horizontal overflow on phones)
 * Both render the same API data and link users to /profile/[handle].
 */
export default function LeaderboardTable({ preselectedId = '' }) {
  const { user } = useAuth();
  const { error } = useToast();
  const [challenges, setChallenges] = useState([]);
  const [selected, setSelected] = useState(preselectedId || '');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const data = await leaderboardApi.myChallenges();
        if (cancelled) return;
        const list = data.challenges || [];
        setChallenges(list);
        if (preselectedId && list.some((c) => c.id === preselectedId)) {
          setSelected(preselectedId);
        } else if (list.length > 0) {
          setSelected(list[0].id);
        }
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
  }, [user, error, preselectedId]);

  useEffect(() => {
    let cancelled = false;
    async function loadBoard() {
      if (!selected) return;
      setLoadingBoard(true);
      try {
        const data = await leaderboardApi.forChallenge(selected);
        if (!cancelled) setBoard(data);
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoadingBoard(false);
      }
    }
    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [selected, error]);

  if (!user) return null;
  if (loading) return <LeaderboardSkeleton />;

  if (challenges.length === 0) {
    return (
      <Card className="items-center gap-2 py-8 text-center">
        <h3 className="text-base font-semibold">No leaderboards yet</h3>
        <p className="text-sm text-ink-soft">
          Join a challenge from the Challenges tab to appear on its leaderboard.
        </p>
      </Card>
    );
  }

  const activeChallenge = challenges.find((c) => c.id === selected);
  const meta = CHALLENGE_TYPE_MAP[board?.challenge?.type] || { label: board?.challenge?.type || '' };

  const rows = board?.leaderboard || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-x -mx-1 px-1">
        <div className="flex min-w-max gap-1.5 pb-1">
          {challenges.map((challenge) => (
            <button
              key={challenge.id}
              type="button"
              onClick={() => setSelected(challenge.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                selected === challenge.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface text-ink-soft hover:bg-surface-sunken'
              }`}
            >
              {challenge.name}
            </button>
          ))}
        </div>
      </div>

      {activeChallenge && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <Badge tone="neutral">{meta.label}</Badge>
          <span>
            Goal {formatNumber(activeChallenge.goal, 0)} {activeChallenge.goalUnit}
          </span>
          <span>•</span>
          <span>{activeChallenge.memberCount} athletes</span>
          {board?.viewerRank ? (
            <>
              <span>•</span>
              <span className="font-semibold text-ink">You’re #{board.viewerRank}</span>
            </>
          ) : null}
        </div>
      )}

      {loadingBoard ? (
        <LeaderboardSkeleton />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No participants yet.</p>
      ) : (
        <>
          {/* Desktop / tablet: real table */}
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Leaderboard for {board?.challenge?.name}, sorted by progress
              </caption>
              <thead>
                <tr className="bg-surface-sunken text-xs uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Rank
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Athlete
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Progress
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.user.id}
                    className={`border-t border-line ${row.isViewer ? 'bg-accent/20' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                          row.rank === 1
                            ? 'bg-accent text-accent-ink'
                            : 'bg-surface-sunken text-ink-soft'
                        }`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={row.user.name}
                          handle={row.user.handle}
                          avatarUrl={row.user.avatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0 leading-tight">
                          <UserLink
                            user={row.user}
                            className="block truncate text-sm font-medium"
                          />
                          <span className="text-xs text-ink-soft">@{row.user.handle}</span>
                        </div>
                        {row.isViewer ? (
                          <Badge tone="pr" className="ml-1">
                            You
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="tnum text-sm font-medium">
                          {formatNumber(row.progress, 1)} {board?.challenge?.goalUnit}
                          <span className="font-normal text-ink-soft">
                            {' '}
                            / {formatNumber(row.goal, 0)}
                          </span>
                        </span>
                        <span className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full bg-accent"
                            style={{ width: `${row.percent}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="tnum text-sm">{row.streak}d 🔥</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((row) => (
              <li
                key={row.user.id}
                className={`card flex items-center gap-3 p-3 ${row.isViewer ? 'ring-1 ring-accent-deep' : ''}`}
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    row.rank === 1 ? 'bg-accent text-accent-ink' : 'bg-surface-sunken text-ink-soft'
                  }`}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <UserLink user={row.user} className="block truncate text-sm font-semibold" />
                  <span className="text-xs text-ink-soft">@{row.user.handle}</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                      <span className="block h-full bg-accent" style={{ width: `${row.percent}%` }} />
                    </span>
                    <span className="tnum shrink-0 text-xs text-ink-soft">{row.percent}%</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-sm font-semibold">
                    {formatNumber(row.progress, 1)}
                    <span className="text-[11px] font-normal text-ink-soft">
                      {board?.challenge?.goalUnit}
                    </span>
                  </p>
                  <p className="text-[11px] text-ink-soft">{row.streak}d 🔥</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}