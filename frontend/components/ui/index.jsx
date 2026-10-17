import { cloneElement, isValidElement } from 'react';

export function FeedCardSkeleton() {
  return (
    <article className="card flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-1/3 rounded-full skeleton" />
          <div className="h-2 w-1/5 rounded-full skeleton" />
        </div>
        <div className="h-2 w-12 rounded-full skeleton" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-4/5 rounded-full skeleton" />
        <div className="h-2.5 w-3/5 rounded-full skeleton" />
        <div className="h-2 w-2/5 rounded-full skeleton" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-8 w-20 rounded-2xl skeleton" />
        <div className="h-8 w-20 rounded-2xl skeleton" />
      </div>
    </article>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`card flex flex-col gap-4 p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Section({ title, subtitle, children, actions }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          {subtitle ? <p className="text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  asChild = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-accent text-accent-ink shadow-[0_1px_0_rgba(17,19,16,0.12)_inset] hover:bg-accent-deep',
    secondary: 'bg-surface border border-line text-ink hover:bg-surface-sunken',
    ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
    danger: 'bg-danger text-white hover:opacity-95',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
    xs: 'px-2 py-1 text-[11px]',
  };
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  // `asChild` renders the single child element with the button styling so a
  // <Link> can look like a button without nesting interactive elements.
  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      className: `${classes} ${children.props.className || ''}`.trim(),
    });
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

export function Chip({ label, active, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-1 text-xs font-medium transition sm:text-sm ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-ink-soft hover:bg-surface-sunken hover:text-ink'
      } ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'border-line bg-surface-sunken text-ink-soft',
    pr: 'border-[#b6d21f]/60 bg-accent/90 text-accent-ink',
    run: 'border-[#2f6bff]/40 bg-[#2f6bff]/10 text-[#1f52c7]',
    gym: 'border-[#ff5a3c]/40 bg-[#ff5a3c]/10 text-[#c63f26]',
    yoga: 'border-[#7c5cff]/40 bg-[#7c5cff]/10 text-[#5841b5]',
    success: 'border-[#12805c]/40 bg-[#e4f6ee] text-[#0b4a35]',
    danger: 'border-[#d92d20]/40 bg-[#fdecea] text-[#7a1c14]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="space-y-1">
        <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
        {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, subtext, trend }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <span className="text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="tnum text-2xl font-semibold sm:text-3xl">{value}</span>
        {trend ? <span className="text-xs text-ink-soft">{trend}</span> : null}
      </div>
      {subtext ? <p className="text-xs text-ink-soft">{subtext}</p> : null}
    </div>
  );
}