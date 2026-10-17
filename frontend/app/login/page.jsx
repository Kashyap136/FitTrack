import { Suspense } from 'react';
import LoginView from '@/components/LoginView';

export const metadata = {
  title: 'Sign in',
};

function LoginFallback() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4 sm:py-8">
      <div className="h-8 w-48 rounded-xl skeleton" />
      <div className="card h-72 skeleton" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginView />
    </Suspense>
  );
}