'use client';

import { AuthProvider } from './auth-context';
import { ToastProvider } from './toast-context';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}