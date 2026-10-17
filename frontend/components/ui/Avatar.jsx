'use client';

import Link from 'next/link';
import { initials, avatarPalette } from '@/lib/format';

export function Avatar({ name, handle, avatarUrl, size = 'md', className = '' }) {
  const palette = avatarPalette(handle || name || '');
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${name || handle} avatar`}
        className={`rounded-2xl object-cover ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl font-semibold uppercase shadow-[0_1px_0_rgba(255,255,255,0.25)_inset] ${sizes[size]} ${className}`}
      style={{ backgroundColor: palette[1], color: palette[0] }}
    >
      {initials(name, handle)}
    </span>
  );
}

export function UserLink({ user, className = '', children }) {
  if (!user?.handle) return <span className={className}>{children || user?.name}</span>;
  return (
    <Link href={`/profile/${user.handle}`} className={`hover:underline ${className}`}>
      {children || user.name || `@${user.handle}`}
    </Link>
  );
}