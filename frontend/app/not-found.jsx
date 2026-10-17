import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">404</p>
      <h1 className="text-2xl font-semibold sm:text-3xl">This page took a rest day</h1>
      <p className="text-sm text-ink-soft">
        The page you’re looking for doesn’t exist. Head back to the feed and keep training.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/feed" className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
          Go to feed
        </Link>
        <Link href="/" className="rounded-2xl border border-line bg-surface px-4 py-2 text-sm font-semibold">
          Home
        </Link>
      </div>
    </div>
  );
}