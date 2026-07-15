import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import type { User } from './db/schema';
import { safeAdminPath } from './redirects';

/**
 * Authoritative guard for protected server-component pages.
 * Middleware remains a fast first layer; this database-backed check is the
 * boundary that prevents a bypassed/revoked token from reaching page loaders.
 */
export async function requireAdminPage(nextPath: string): Promise<User> {
  const destination = safeAdminPath(nextPath);
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/admin/login?next=${encodeURIComponent(destination)}`);
  }
  return user;
}
