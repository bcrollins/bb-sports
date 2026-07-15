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
    <main id="main" className="fixed inset-0 z-[9999] grid min-h-screen place-items-center bg-white px-4 text-black">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-black/45">Soft launch</p>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight">BB Sports</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-black/65">
            Private preview for invited readers. The public desk stays passworded until Brad
            opens the wall. Newsletter signup and tips still work for invited guests after
            entry — donations stay off until Stripe is proven live.
          </p>
        </div>
        <GateForm nextPath={next} />
      </div>
    </main>
  );
}
