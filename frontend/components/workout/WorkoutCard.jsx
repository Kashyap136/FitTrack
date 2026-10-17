'use client';

import { useState } from 'react';
import { Button, Badge } from '../ui';
import { Avatar, UserLink } from '../ui/Avatar';
import { formatDateTime, relativeTime, WORKOUT_TYPE_MAP } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { feedApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';

function CommentRow({ comment }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={comment.user?.name} handle={comment.user?.handle} avatarUrl={comment.user?.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1 rounded-2xl bg-surface-sunken px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <UserLink user={comment.user} className="text-sm font-semibold" />
          <span className="text-xs text-ink-soft">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{comment.text}</p>
      </div>
    </div>
  );
}

/**
 * Workout feed card. Displays type-specific summary, PR badge, likes/comments
 * (persisted to the API) and a comment composer. This is the core social unit
 * the specification asks for.
 */
export default function WorkoutCard({ workout, onUpdated }) {
  const { user, isAuthenticated } = useAuth();
  const { success, error } = useToast();
  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localWorkout, setLocalWorkout] = useState(workout);

  const w = localWorkout;
  const meta = WORKOUT_TYPE_MAP[w.type] || { label: w.type, color: 'neutral' };

  const isLiked = isAuthenticated && w.likedBy?.includes?.(user?.id || user?._id);

  const handleLike = async () => {
    if (!isAuthenticated) return;
    setLiking(true);
    try {
      const data = await feedApi.like(w.id);
      setLocalWorkout((current) => ({
        ...current,
        likeCount: data.likeCount,
        likedBy: data.liked
          ? [...(current.likedBy || []), user?.id || user?._id]
          : (current.likedBy || []).filter((id) => id !== (user?.id || user?._id)),
      }));
      if (onUpdated) onUpdated(data);
    } catch (err) {
      error(errorMessage(err));
    } finally {
      setLiking(false);
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!isAuthenticated || !commentText.trim()) return;
    setCommenting(true);
    try {
      const data = await feedApi.comment(w.id, commentText.trim());
      setLocalWorkout((current) => ({
        ...current,
        commentCount: data.commentCount,
        comments: [...(current.comments || []), data.comment],
      }));
      setCommentText('');
      setShowComments(true);
      success('Comment added');
      if (onUpdated) onUpdated(data);
    } catch (err) {
      error(errorMessage(err));
    } finally {
      setCommenting(false);
    }
  };

  const metricLines = [];

  if (w.type === 'run') {
    if (w.data?.distance > 0) metricLines.push(`${Number(w.data.distance).toFixed(1)} km`);
    if (w.data?.duration > 0) metricLines.push(`${Math.round(w.data.duration)} min`);
    if (w.pace) metricLines.push(`${w.pace} min/km`);
  } else if (w.type === 'gym') {
    if (w.data?.exercise) metricLines.push(w.data.exercise);
    if (w.data?.sets > 0 && w.data?.reps > 0)
      metricLines.push(`${w.data.sets} × ${w.data.reps}`);
    if (w.data?.weight > 0) metricLines.push(`${Number(w.data.weight).toFixed(1)} kg`);
    if (w.data?.duration > 0) metricLines.push(`${Math.round(w.data.duration)} min`);
  } else if (w.type === 'yoga') {
    if (w.data?.duration > 0) metricLines.push(`${Math.round(w.data.duration)} min`);
    if (w.data?.holdSeconds > 0) metricLines.push(`${Math.round(w.data.holdSeconds)}s hold`);
  }

  if (w.calories > 0) metricLines.push(`${Math.round(w.calories)} kcal`);

  return (
    <article className="card flex flex-col gap-4 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            name={w.user?.name}
            handle={w.user?.handle}
            avatarUrl={w.user?.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex flex-col leading-none">
            <UserLink user={w.user} className="truncate text-sm font-semibold sm:text-base" />
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft sm:text-sm">
              <span>@{w.user?.handle}</span>
              <span>•</span>
              <time title={formatDateTime(w.date)}>{relativeTime(w.date)}</time>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Badge tone={meta.color}>{meta.label}</Badge>
          {w.pr ? (
            <Badge tone="pr" className="animate-pulse">
              PR 🎉
            </Badge>
          ) : null}
        </div>
      </header>

      {(w.title || w.notes) && (
        <div className="space-y-1">
          {w.title ? <h3 className="text-base font-semibold sm:text-lg">{w.title}</h3> : null}
          {w.notes ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{w.notes}</p> : null}
        </div>
      )}

      {metricLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {metricLines.map((line, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-full border border-line bg-surface-sunken px-2.5 py-0.5 text-xs text-ink sm:text-sm"
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {w.pr && w.prHighlights?.length > 0 && (
        <div className="rounded-2xl border border-[#b6d21f]/60 bg-accent/30 p-3 text-sm text-accent-ink">
          <p className="font-semibold">New personal record</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {w.prHighlights.map((highlight, index) => (
              <li key={index}>{highlight}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={!isAuthenticated || liking}
            className={`inline-flex items-center gap-1.5 rounded-2xl border px-2.5 py-1 text-xs font-medium transition sm:text-sm ${
              isLiked
                ? 'border-[#b6d21f]/70 bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink-soft hover:bg-surface-sunken hover:text-ink'
            }`}
            aria-pressed={isLiked}
            aria-label={`${isLiked ? 'Unlike' : 'Like'} this workout. ${w.likeCount || 0} likes`}
          >
            <span aria-hidden="true">{isLiked ? '❤️' : '🤍'}</span>
            {w.likeCount || 0}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-sunken hover:text-ink sm:text-sm"
            aria-expanded={showComments}
            aria-controls={`comments-${w.id}`}
            aria-label={`${showComments ? 'Hide' : 'Show'} comments. ${w.commentCount || 0} comments`}
          >
            <span aria-hidden="true">💬</span> {w.commentCount || 0}
          </button>
        </div>
        <span className="text-xs text-ink-soft">{formatDateTime(w.date)}</span>
      </footer>

      {showComments && (
        <div id={`comments-${w.id}`} className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex max-h-60 flex-col gap-2.5 overflow-y-auto pr-1">
            {(w.comments || []).length === 0 ? (
              <p className="text-sm text-ink-soft">Be the first to leave a comment.</p>
            ) : (
              w.comments.map((comment, index) => <CommentRow key={comment.id || index} comment={comment} />)
            )}
          </div>

          {isAuthenticated ? (
            <form onSubmit={handleComment} className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`comment-${w.id}`} className="sr-only">
                  Add a comment
                </label>
                <textarea
                  id={`comment-${w.id}`}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Add a comment…"
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-line bg-surface px-3 py-2 text-sm shadow-sm transition focus:border-ink focus:outline-none"
                  maxLength={500}
                />
              </div>
              <Button type="submit" size="sm" loading={commenting} disabled={!commentText.trim()}>
                Post
              </Button>
            </form>
          ) : (
            <p className="text-sm text-ink-soft">Sign in to like and comment.</p>
          )}
        </div>
      )}
    </article>
  );
}