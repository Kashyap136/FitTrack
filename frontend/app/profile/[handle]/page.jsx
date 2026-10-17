import { ProfilePage } from '@/components/pages';

export const metadata = {
  title: 'Profile',
};

export default async function Page({ params }) {
  const { handle } = await params;
  return <ProfilePage handle={handle} />;
}