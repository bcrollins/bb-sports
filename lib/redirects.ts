export function safeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\0')) {
    return fallback;
  }
  return trimmed;
}

export function safeAdminPath(value: unknown, fallback = '/admin'): string {
  const path = safeInternalPath(value, fallback);
  return path.startsWith('/admin') ? path : fallback;
}
