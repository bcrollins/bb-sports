'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setPending(true);
        try {
          await fetch('/api/admin/logout', { method: 'POST' });
        } finally {
          router.push('/admin/login');
          router.refresh();
        }
      }}
      className="inline-flex min-h-[36px] items-center rounded bg-broadcast-red px-3 text-xs font-black uppercase tracking-[0.16em] text-bone hover:bg-broadcast-red/90 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'Out…' : 'Sign out'}
    </button>
  );
}
