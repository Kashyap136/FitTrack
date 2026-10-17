'use client';

import { useState } from 'react';
import { Card, Button } from '../ui';
import { challengeApi } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { toDateInputValue } from '@/lib/format';
import { CHALLENGE_TYPES } from '@/lib/format';

const DEFAULT_START = toDateInputValue();
const DEFAULT_END = toDateInputValue(new Date(Date.now() + 29 * 86400000));

/** Create-challenge form (POST /api/challenges/create). */
export default function CreateChallengeForm({ onCreated }) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'run',
    goal: '',
    startDate: DEFAULT_START,
    endDate: DEFAULT_END,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 3) next.name = 'Name must be at least 3 characters';
    if (!form.goal || Number(form.goal) <= 0) next.goal = 'Goal must be greater than 0';
    if (!form.startDate) next.startDate = 'Pick a start date';
    if (!form.endDate) next.endDate = 'Pick an end date';
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      next.endDate = 'End date must be after start date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = await challengeApi.create({
        name: form.name.trim(),
        type: form.type,
        goal: Number(form.goal),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      success(data.message || 'Challenge created');
      setForm({ name: '', type: 'run', goal: '', startDate: DEFAULT_START, endDate: DEFAULT_END });
      setOpen(false);
      if (onCreated) onCreated(data.challenge);
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        + Create a challenge
      </Button>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm transition focus:border-ink focus:outline-none sm:text-base';

  return (
    <Card className="gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold sm:text-lg">Create a challenge</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close create challenge form">
          ✕
        </Button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="challenge-name" className="text-xs font-medium text-ink-soft sm:text-sm">
            Challenge name
          </label>
          <input
            id="challenge-name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Morning 5K Streak"
            className={inputClass}
            maxLength={80}
          />
          {errors.name ? (
            <p className="text-xs text-danger" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-type" className="text-xs font-medium text-ink-soft sm:text-sm">
              Type
            </label>
            <select
              id="challenge-type"
              value={form.type}
              onChange={(event) => set('type', event.target.value)}
              className={inputClass}
            >
              {CHALLENGE_TYPES.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label} ({option.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-goal" className="text-xs font-medium text-ink-soft sm:text-sm">
              Goal
            </label>
            <input
              id="challenge-goal"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="0.1"
              value={form.goal}
              onChange={(event) => set('goal', event.target.value)}
              placeholder="50"
              className={inputClass}
            />
            {errors.goal ? (
              <p className="text-xs text-danger" role="alert">
                {errors.goal}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-start" className="text-xs font-medium text-ink-soft sm:text-sm">
              Start date
            </label>
            <input
              id="challenge-start"
              type="date"
              value={form.startDate}
              onChange={(event) => set('startDate', event.target.value)}
              className={inputClass}
            />
            {errors.startDate ? (
              <p className="text-xs text-danger" role="alert">
                {errors.startDate}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-end" className="text-xs font-medium text-ink-soft sm:text-sm">
              End date
            </label>
            <input
              id="challenge-end"
              type="date"
              value={form.endDate}
              onChange={(event) => set('endDate', event.target.value)}
              className={inputClass}
            />
            {errors.endDate ? (
              <p className="text-xs text-danger" role="alert">
                {errors.endDate}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create challenge'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}