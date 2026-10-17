'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-sm transition focus:border-ink focus:outline-none sm:text-base';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const { success, error } = useToast();

  const [form, setForm] = useState({
    name: '',
    handle: '',
    email: '',
    password: '',
    weight: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/feed');
  }, [isAuthenticated, isLoading, router]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [key]: key === 'handle' ? value.toLowerCase().replace(/[^a-z0-9_.]/g, '') : value,
    }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name';
    if (!/^[a-z0-9_.]{3,24}$/.test(form.handle))
      next.handle = '3-24 characters: letters, numbers, dots, underscores';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim())) next.email = 'Enter a valid email';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      next.password = 'At least 8 characters with letters and numbers';
    if (form.weight !== '' && (Number(form.weight) < 20 || Number(form.weight) > 400))
      next.weight = 'Weight must be between 20 and 400 kg';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const newUser = await register({
        name: form.name.trim(),
        handle: form.handle.trim(),
        email: form.email.trim(),
        password: form.password,
        weight: form.weight === '' ? undefined : Number(form.weight),
      });
      success(`Welcome to FitTrack, ${newUser.name.split(' ')[0]}!`);
      router.replace('/feed');
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4 sm:py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold sm:text-3xl">Create your account</h1>
        <p className="text-sm text-ink-soft">
          Track workouts, beat your PRs and climb the leaderboards.
        </p>
      </div>

      <Card className="gap-5">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-ink-soft sm:text-sm">
              Full name
            </label>
            <input
              id="name"
              value={form.name}
              onChange={set('name')}
              placeholder="Aarav Sharma"
              autoComplete="name"
              className={inputClass}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name ? (
              <p className="text-xs text-danger" role="alert">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="handle" className="text-xs font-medium text-ink-soft sm:text-sm">
              Handle
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-soft">@</span>
              <input
                id="handle"
                value={form.handle}
                onChange={set('handle')}
                placeholder="aaravfit"
                className={inputClass}
                aria-invalid={errors.handle ? 'true' : 'false'}
              />
            </div>
            {errors.handle ? (
              <p className="text-xs text-danger" role="alert">
                {errors.handle}
              </p>
            ) : (
              <p className="text-xs text-ink-faint">Your profile will live at /profile/{form.handle || 'handle'}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-email" className="text-xs font-medium text-ink-soft sm:text-sm">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              className={inputClass}
              aria-invalid={errors.email ? 'true' : 'false'}
            />
            {errors.email ? (
              <p className="text-xs text-danger" role="alert">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-password" className="text-xs font-medium text-ink-soft sm:text-sm">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              placeholder="At least 8 characters"
              className={inputClass}
              aria-invalid={errors.password ? 'true' : 'false'}
            />
            {errors.password ? (
              <p className="text-xs text-danger" role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="weight" className="text-xs font-medium text-ink-soft sm:text-sm">
              Weight <span className="text-xs text-ink-faint">(optional, kg)</span>
            </label>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              min={20}
              max={400}
              step={0.1}
              value={form.weight}
              onChange={set('weight')}
              placeholder="72"
              className={inputClass}
              aria-invalid={errors.weight ? 'true' : 'false'}
            />
            {errors.weight ? (
              <p className="text-xs text-danger" role="alert">
                {errors.weight}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" loading={submitting} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}