'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { AnalyticsEventName } from '@/lib/analytics';

type AnalyticsProperties = Record<string, string | number | boolean | null>;

const ANON_ID_KEY = 'bb_anon_id';
const OPT_OUT_KEY = 'bb_analytics_opt_out';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!pathname) return;
    if (clientAnalyticsBlocked()) return;
    void trackAnalytics(
      'page_view',
      {
        has_query: search.length > 0,
      },
      { path: pathname },
    );

    const articleMatch = pathname.match(/^\/articles\/([^/?#]+)/);
    if (articleMatch?.[1]) {
      void trackAnalytics(
        'article_view',
        {
          slug: articleMatch[1].slice(0, 160),
        },
        { path: pathname },
      );
    }
  }, [pathname, search]);

  return null;
}

export function AnalyticsEventBeacon({
  eventName,
  path,
  source = 'site',
  properties = {},
}: {
  eventName: AnalyticsEventName;
  path?: string;
  source?: string;
  properties?: AnalyticsProperties;
}) {
  const propertiesKey = stablePropertiesKey(properties);

  useEffect(() => {
    if (clientAnalyticsBlocked()) return;
    void trackAnalytics(eventName, JSON.parse(propertiesKey) as AnalyticsProperties, {
      path,
      source,
    });
  }, [eventName, path, source, propertiesKey]);

  return null;
}

/** Browser privacy signals + explicit local opt-out. */
export function clientAnalyticsBlocked(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  try {
    if (window.localStorage.getItem(OPT_OUT_KEY) === '1') return true;
  } catch {
    // storage blocked — still allow network path; server re-checks GPC/DNT
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack || (window as Window & { doNotTrack?: string }).doNotTrack;
  if (dnt === '1' || dnt === 'yes') return true;
  if (typeof document !== 'undefined' && /(?:^|;\s*)bb_analytics=0(?:;|$)/i.test(document.cookie)) {
    return true;
  }
  return false;
}

export async function trackAnalytics(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: { path?: string; source?: string } = {},
) {
  if (typeof window === 'undefined') return;
  if (clientAnalyticsBlocked()) return;
  const path = options.path || window.location.pathname;
  const payload = {
    eventName,
    path,
    referrer: document.referrer || '',
    source: options.source || 'site',
    anonId: getAnonId(),
    properties,
  };
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetry is opportunistic and must not interrupt reading.
  }
}

function getAnonId(): string {
  try {
    if (window.localStorage.getItem(OPT_OUT_KEY) === '1') return 'opted_out';
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const next =
      window.crypto?.randomUUID?.() ?? `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(ANON_ID_KEY, next);
    return next;
  } catch {
    return 'storage_unavailable';
  }
}

function stablePropertiesKey(properties: AnalyticsProperties) {
  return JSON.stringify(properties);
}
