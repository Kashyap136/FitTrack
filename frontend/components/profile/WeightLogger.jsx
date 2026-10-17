'use client';

import { useState } from 'react';
import { Button } from '../ui';
import { authApi, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

/**
 * Owner-only control for recording a dated weight measurement. Posts to
 * POST /api/auth/weight, which also updates the user's current weight and feeds
 * the profile weight chart.
 */
export default function WeightLogger({ currentWeight, onLogged }) {
  const { success, error } = useToast();
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 20 || value > 400) {
      setFieldError('Enter a weight between 20 and 400 kg');
      return;
    }

    setFieldError('');
    setSaving(true);
    try {
      await authApi.logWeight({ weight: value });
      success('Weight logged');
      setWeight('');
      if (onLogged) onLogged();
    } catch (err) {
      if (err.fieldErrors?.weight) setFieldError(err.fieldErrors.weight);
      else error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <label htmlFor="weight-input" className="flex flex-col gap-1 text-xs font-medium text-ink-soft sm:text-sm">
        Log weight (kg)
        <input
          id="weight-input"
          type="number"
          inputMode="decimal"
          min={20}
          max={400}
          step={0.1}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          placeholder={currentWeight ? String(currentWeight) : '72.5'}
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm transition focus:border-ink focus:outline-none"
        />
      </label>
      <Button type="submit" size="sm" loading={saving} disabled={!weight || saving}>
        Add
      </Button>
      {fieldError ? (
        <p className="w-full text-xs text-danger" role="alert">
          {fieldError}
        </p>
      ) : null}
    </form>
  );
}
