/**
 * Citation link inventory for editorial review — extract only, never copy source bodies.
 * Optional probe is SSRF-safe (HTTPS, public hosts, timeouts, no body download).
 */
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const MARKDOWN_LINK = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/gi;
const BARE_HTTPS = /(?<![\w/])(https:\/\/[^\s)>"']+)/gi;

export type CitationLink = {
  url: string;
  label: string;
  kind: 'markdown' | 'bare';
};

export function extractCitationLinks(body: string): CitationLink[] {
  const seen = new Set<string>();
  const out: CitationLink[] = [];

  let m: RegExpExecArray | null;
  const md = new RegExp(MARKDOWN_LINK.source, 'gi');
  while ((m = md.exec(body)) != null) {
    const url = m[2]!.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, label: m[1]!.trim() || url, kind: 'markdown' });
  }

  const bare = new RegExp(BARE_HTTPS.source, 'gi');
  while ((m = bare.exec(body)) != null) {
    const url = m[1]!.trim().replace(/[.,;:]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, label: url, kind: 'bare' });
  }

  return out;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const v4 = ip.includes('.') ? ip : null;
  if (!v4) return false;
  const parts = v4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b! >= 64 && b! <= 127) return true; // CGNAT
  return false;
}

export async function assertPublicHttpsUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:') throw new Error('Only https citations are checked');
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private hostnames are blocked');
  }
  // Prefer IP form rejection
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error('Private IP is blocked');
  }
  const records = await lookup(hostname, { all: true });
  for (const rec of records) {
    if (isPrivateIp(rec.address)) throw new Error('Resolves to private network');
  }
  return url;
}

export type CitationProbeResult = {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
};

/**
 * HEAD/GET with no body retention — status only. Fail closed on SSRF/timeouts.
 */
export async function probeCitationUrl(
  urlString: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CitationProbeResult> {
  try {
    const url = await assertPublicHttpsUrl(urlString);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetchImpl(url.toString(), {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'BB-Sports-Citation-Monitor/1.0' },
      });
      // Accept 2xx/3xx as reachable; 405 may mean HEAD blocked — try GET range
      if (res.status === 405 || res.status === 501) {
        const getRes = await fetchImpl(url.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': 'BB-Sports-Citation-Monitor/1.0',
            range: 'bytes=0-0',
          },
        });
        return { url: urlString, ok: getRes.status < 400, status: getRes.status };
      }
      return { url: urlString, ok: res.status > 0 && res.status < 400, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      url: urlString,
      ok: false,
      error: err instanceof Error ? err.message : 'Probe failed',
    };
  }
}
