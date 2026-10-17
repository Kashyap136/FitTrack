'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Button } from './ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

const DEMO_ACCOUNTS = [
  { email: 'aarav@example.com', name: 'Aarav Sharma', handle: 'aaravfit' },
  { email: 'priya@example.com', name: 'Priya Verma', handle: 'priyafit' },
  { email: 'rohan@example.com', name: 'Rohan Mehta', handle: 'rohanruns' },
];

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-sm transition focus:border-ink focus:outline-none sm:text-base';

/** Only same-origin relative paths are honoured as post-login destinations. */
function safeNextPath(raw) {
  if (typeof raw !== 'string') return '/feed';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/feed';
  return raw;
}

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();
  const { success, error } = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(searchParams.get('next'));

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, isLoading, router, nextPath]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setErrors({});

    if (!form.email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }
    if (!form.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login({ email: form.email.trim(), password: form.password });
      success(`Welcome back, ${loggedInUser.name.split(' ')[0]}`);
      router.replace(nextPath);
    } catch (err) {
      error(errorMessage(err, 'Couldn’t sign you in'));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account) => {
    setForm({ email: account.email, password: 'FitTrack@123' });
    setErrors({});
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4 sm:py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold sm:text-3xl">Welcome back</h1>
        <p className="text-sm text-ink-soft">Sign in to log workouts and join challenges.</p>
      </div>

      <Card className="gap-5">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-ink-soft sm:text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
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
            <label htmlFor="password" className="text-xs font-medium text-ink-soft sm:text-sm">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              placeholder="••••••••"
              className={inputClass}
              aria-invalid={errors.password ? 'true' : 'false'}
            />
            {errors.password ? (
              <p className="text-xs text-danger" role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" loading={submitting} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-soft">
          New to FitTrack?{' '}
          <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </Card>

      <Card className="gap-3">
        <h2 className="text-sm font-semibold">Demo accounts</h2>
        <p className="text-xs text-ink-soft">
          Password for every seeded account:{' '}
          <code className="rounded bg-surface-sunken px-1 py-0.5">FitTrack@123</code>
        </p>
        <div className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account)}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:bg-surface-sunken"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{account.name}</span>
                <span className="block truncate text-xs text-ink-soft">{account.email}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-ink-soft">Use</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}