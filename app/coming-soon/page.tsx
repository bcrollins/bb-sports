/**
 * /coming-soon — site-wide white access wall.
 *
 * This route intentionally lives outside the public `(site)` layout so the
 * public header, ticker, footer, analytics, and links never exist behind the
 * white wall in the DOM or keyboard focus order.
 */
import { safeInternalPath } from '@/lib/redirects';
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
  const next = safeInternalPath(params.next);

  return (
    <main id="main" className="fixed inset-0 z-[9999] grid min-h-screen place-items-center bg-white text-black">
      <GateForm nextPath={next} />
    </main>
  );
}
