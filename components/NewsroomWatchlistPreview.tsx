'use client';

import { useMemo, useState } from 'react';
import {
  matchWatchlist,
  parseWatchlistRules,
  type WatchlistRule,
} from '@/lib/newsroom-watchlist';

type PreviewSignal = {
  id: string;
  text: string;
  sport?: string;
  team?: string;
  urgency?: number;
  sourceAuthorized: boolean;
};

const DEFAULT_RULES: WatchlistRule[] = parseWatchlistRules([
  {
    id: 'bears-nfl',
    sport: 'nfl',
    team: 'Bears',
    keywords: ['injury', 'trade', 'suspension', 'contract'],
    urgencyMin: 40,
    enabled: true,
    requireAuthorizedSource: true,
  },
  {
    id: 'cfb-florida',
    sport: 'college-football',
    keywords: ['florida', 'gators'],
    enabled: true,
    requireAuthorizedSource: true,
  },
]);

/**
 * Editorial watchlist preview — pure client match against open desk signals.
 * Never auto-publishes; unauthorized sources never match.
 */
export default function NewsroomWatchlistPreview({
  signals,
}: {
  signals: PreviewSignal[];
}) {
  const [rulesJson, setRulesJson] = useState(() => JSON.stringify(DEFAULT_RULES, null, 2));
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(() => {
    try {
      const parsed = parseWatchlistRules(JSON.parse(rulesJson));
      setError(null);
      return parsed;
    } catch {
      setError('Invalid JSON rules — using last good empty set.');
      return [] as WatchlistRule[];
    }
  }, [rulesJson]);

  const hits = useMemo(() => {
    return signals
      .map((signal) => ({
        signal,
        matches: matchWatchlist(rules, {
          text: signal.text,
          sport: signal.sport,
          team: signal.team,
          urgency: signal.urgency,
          sourceAuthorized: signal.sourceAuthorized,
        }),
      }))
      .filter((row) => row.matches.length > 0);
  }, [signals, rules]);

  return (
    <section
      className="rounded-xl border border-navy/15 bg-white shadow-sm"
      aria-labelledby="watchlist-preview-heading"
    >
      <div className="border-b border-navy/10 px-5 py-4">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-navy/45">
          Editorial routing
        </p>
        <h2 id="watchlist-preview-heading" className="mt-1 font-serif text-xl font-bold text-navy-900">
          Watchlist preview
        </h2>
        <p className="mt-1 text-sm text-charcoal/70">
          Local rule preview against open desk signals. Matches are explanations only — never
          auto-publish. Unauthorized sources never fire.
        </p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div>
          <label htmlFor="watchlist-rules" className="text-xs font-bold uppercase tracking-[0.14em] text-navy/55">
            Rules JSON
          </label>
          <textarea
            id="watchlist-rules"
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
            rows={12}
            spellCheck={false}
            className="mt-2 w-full rounded border border-navy/20 bg-bone-50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-breaking/40"
          />
          {error ? (
            <p className="mt-2 text-xs text-breaking" role="alert">
              {error}
            </p>
          ) : (
            <p className="mt-2 text-xs text-navy/50">{rules.length} rule(s) active</p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-navy/55">
            Matches ({hits.length})
          </p>
          {hits.length === 0 ? (
            <p className="mt-3 text-sm text-navy/55">No open signals match the current rules.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
              {hits.map(({ signal, matches }) => (
                <li key={signal.id} className="rounded border border-navy/10 bg-bone-50 p-3">
                  <p className="text-sm font-semibold text-navy-900">{signal.text}</p>
                  <ul className="mt-2 space-y-1">
                    {matches.map((m) => (
                      <li key={m.ruleId} className="font-mono text-[10px] text-navy/60">
                        rule {m.ruleId}: {m.reasons.join(' · ')}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
