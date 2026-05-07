/**
 * /coming-soon — site-wide white access wall.
 *
 * Public visitors see only a white screen and password field until /api/gate
 * sets bb_gate. Admin authentication remains a separate layer after the wall.
 */
import { Suspense } from 'react';
import GateForm from './GateForm';

export const metadata = {
  title: 'Access · BB Sports',
  description: 'BB Sports access wall.',
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div className="fixed inset-0 z-[9999] grid min-h-screen place-items-center bg-white text-black">
      <Suspense fallback={<div className="h-11 w-[280px] border border-black/10" />}>
        <GateForm />
      </Suspense>
    </div>
  );
}
