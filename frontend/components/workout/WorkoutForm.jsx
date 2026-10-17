'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { workoutApi, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { Card, Button } from '../ui';
import { WORKOUT_TYPES, toDateTimeLocalValue } from '@/lib/format';
import { WORKOUT_FIELDS, validateWorkoutForm, estimateCalories, emptyDataFor } from '@/lib/workoutForm';

function TextField({ id, label, unit, help, error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-soft sm:text-sm">
        {label}
        {unit ? <span className="ml-1 text-xs text-ink-faint">({unit})</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          aria-invalid={error ? 'true' : 'false'}
          className={`w-full rounded-xl border bg-surface px-3 py-2 text-sm shadow-sm transition focus:outline-none sm:text-base ${
            error ? 'border-danger focus:border-danger' : 'border-line focus:border-ink'
          }`}
        />
      </div>
      {help && !error ? <p className="text-xs text-ink-faint">{help}</p> : null}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Seed the form state from an optional workout being edited. */
function initialForm(workout) {
  if (!workout) {
    return { type: 'run', data: emptyDataFor('run'), calories: '', notes: '', when: 'now' };
  }

  const type = workout.type || 'run';
  const data = emptyDataFor(type);
  const source = workout.data || {};
  Object.keys(data).forEach((key) => {
    if (source[key] !== undefined && source[key] !== null) data[key] = String(source[key]);
  });

  return {
    type,
    data,
    calories: workout.calories != null ? String(workout.calories) : '',
    notes: workout.notes || '',
    when: workout.date ? toDateTimeLocalValue(new Date(workout.date)) : 'now',
  };
}

/**
 * Workout logging form. The input area re-renders per workout type (run / gym /
 * yoga) from the shared field definitions in lib/workoutForm.js.
 * Submits to POST /api/workouts/create, then surfaces PR + streak results.
 */
export default function WorkoutForm({ onLogged, compact = false, editingWorkout = null, onCancel }) {
  const { user } = useAuth();
  const { success, error, celebrate } = useToast();

  // The form is remounted (via `key`) whenever the edit target changes, so
  // seeding the state once from `editingWorkout` is enough — no reset effect.
  const [initial] = useState(() => initialForm(editingWorkout));
  const [type, setType] = useState(initial.type);
  const [data, setData] = useState(initial.data);
  const [calories, setCalories] = useState(initial.calories);
  const [notes, setNotes] = useState(initial.notes);
  const [when, setWhen] = useState(initial.when);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const fields = useMemo(() => WORKOUT_FIELDS[type], [type]);

  const isEditing = Boolean(editingWorkout);

  const switchType = (nextType) => {
    setType(nextType);
    setData(emptyDataFor(nextType));
    setErrors({});
    setCalories('');
  };

  const setField = (name, value) => {
    setData((current) => {
      const next = { ...current, [name]: value };
      if (type === 'run' && (name === 'distance' || name === 'duration')) {
        const estimate = estimateCalories('run', next, user?.weight);
        if (estimate > 0) setCalories(String(estimate));
      }
      return next;
    });
  };

  const autoEstimateCalories = () => {
    const estimate = estimateCalories(type, data, user?.weight);
    if (estimate > 0) setCalories(String(estimate));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setLastResult(null);

    const payload = { type, data, calories: Number(calories), notes };
    if (when !== 'now') payload.date = new Date(when).toISOString();

    const validation = validateWorkoutForm({ ...payload, dateTime: when || new Date().toISOString() });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      const result = isEditing
        ? await workoutApi.update(editingWorkout.id, payload)
        : await workoutApi.create(payload);

      if (result.pr?.achieved) {
        const highlight = result.pr.highlights?.[0] || 'New best performance';
        celebrate(`Personal record! ${highlight}`, { title: 'PR unlocked' });
      } else if (isEditing) {
        success(result.message || 'Workout updated');
      } else {
        success(result.message || 'Workout logged successfully', {
          title: result.streak > 0 ? `${result.streak} day streak` : 'Logged',
        });
      }

      if (!isEditing) {
        setLastResult(
          result.pr?.achieved
            ? { type: 'pr', message: result.message, highlights: result.pr.highlights }
            : { type: 'ok', message: result.message }
        );
        setData(emptyDataFor(type));
        setCalories('');
        setNotes('');
        setWhen('now');
      }

      if (onLogged) onLogged(result);
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="gap-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold sm:text-xl">
          {isEditing ? 'Edit workout' : 'Log a workout'}
        </h2>
        <p className="text-sm text-ink-soft">
          {isEditing
            ? 'Update the details and we’ll re-check your records.'
            : 'Record a session and we’ll check it against your history for a new PR.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-ink-soft sm:text-sm">Workout type</legend>
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-surface-sunken p-1">
            {WORKOUT_TYPES.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => switchType(option.type)}
                aria-pressed={type === option.type}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                  type === option.type
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <span
                  className="h-1.5 w-6 rounded-full"
                  style={{ backgroundColor: option.accent }}
                  aria-hidden="true"
                />
                {option.label}
                {!compact ? (
                  <span className="hidden text-[10px] font-normal text-ink-faint sm:block">
                    {option.blurb}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {errors.type ? (
            <p className="text-xs text-danger" role="alert">
              {errors.type}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <TextField
              key={field.name}
              id={`field-${field.name}`}
              label={field.label}
              unit={field.unit}
              help={field.help}
              error={errors[`data.${field.name}`]}
              type={field.type}
              inputMode={field.type === 'number' ? 'decimal' : 'text'}
              min={field.min}
              max={field.max}
              step={field.step}
              placeholder={field.placeholder}
              value={data[field.name] ?? ''}
              onChange={(event) => setField(field.name, event.target.value)}
            />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="field-calories"
            label="Calories"
            unit="kcal"
            error={errors.calories}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="420"
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
          />
          <TextField
            id="field-when"
            label="When"
            error={errors.dateTime}
            type="datetime-local"
            value={when === 'now' ? '' : when}
            onChange={(event) => setWhen(event.target.value || 'now')}
            help={when === 'now' ? 'Defaults to now' : undefined}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-notes" className="text-xs font-medium text-ink-soft sm:text-sm">
            Notes <span className="text-xs text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="field-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="How did it feel?"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm transition focus:border-ink focus:outline-none sm:text-base"
          />
          {errors.notes ? (
            <p className="text-xs text-danger" role="alert">
              {errors.notes}
            </p>
          ) : null}
        </div>

        {lastResult && (
          <div
            className={`rounded-2xl border p-3 text-sm ${
              lastResult.type === 'pr'
                ? 'border-[#b6d21f]/60 bg-accent/30 text-accent-ink'
                : 'border-[#12805c]/40 bg-[#e4f6ee] text-[#0b4a35]'
            }`}
            role="status"
          >
            <p className="font-semibold">{lastResult.message}</p>
            {lastResult.highlights?.map((h, i) => (
              <p key={i} className="mt-0.5 text-sm">
                • {h}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" loading={submitting} disabled={submitting} className="flex-1 sm:flex-none">
            {submitting ? (isEditing ? 'Saving…' : 'Logging…') : isEditing ? 'Save changes' : 'Log workout'}
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={autoEstimateCalories} disabled={submitting}>
            Estimate calories
          </Button>
          {isEditing ? (
            <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}