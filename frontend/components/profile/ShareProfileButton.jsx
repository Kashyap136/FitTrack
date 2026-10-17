'use client';

import { useState } from 'react';
import { Button } from '../ui';

/**
 * Share interaction for a public profile. Copies the real profile URL
 * (`/profile/[handle]`) using the Clipboard API with a graceful fallback.
 */
export default function ShareProfileButton({ handle, className = '' }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = () => {
    if (typeof window === 'undefined') return `/profile/${handle}`;
    return `${window.location.origin}/profile/${handle}`;
  };

  const copy = async () => {
    const url = shareUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement('textarea');
        field.value = url;
        field.setAttribute('readonly', '');
        field.style.position = 'absolute';
        field.style.left = '-9999px';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    const url = shareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: `FitTrack profile @${handle}`, url });
        return;
      } catch {
        /* user dismissed the share sheet — fall through to copy */
      }
    }
    copy();
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button type="button" variant="secondary" onClick={copy} className="min-w-[9.5rem]">
        {copied ? '✓ Link copied' : 'Share profile'}
      </Button>
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
        <Button type="button" variant="ghost" onClick={nativeShare} className="sm:hidden">
          Share…
        </Button>
      ) : null}
      <span className="text-xs text-ink-soft" aria-live="polite">
        {copied ? 'Anyone with the link can view this profile.' : ''}
      </span>
    </div>
  );
}