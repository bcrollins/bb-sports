/**
 * /coming-soon — site-wide white access wall.
 *
 * Public visitors see only a white screen and password field until /api/gate
 * sets bb_gate. Admin authentication remains a separate layer after the wall.
 */
import GateForm from './GateForm';

export const metadata = {
  title: 'Access · BB Sports',
  description: 'BB Sports access wall.',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function ComingSoonPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = typeof params.next === 'string' && params.next.startsWith('/') ? params.next : '/';

  return (
    <div className="fixed inset-0 z-[9999] grid min-h-screen place-items-center bg-white text-black">
      <GateForm nextPath={next} />
    </div>
  );
}
