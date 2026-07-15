'use client';

import { useState } from 'react';
import type {
  BreakingTickerItem,
  EditableSiteConfig,
  HeroConfig,
} from '@/lib/editable-site-config';

type BumpItem = BreakingTickerItem;
type HeroShape = HeroConfig;

const SPORT_OPTIONS = ['BREAKING', 'NFL', 'MLB', 'NHL', 'NBA', 'CFB', 'PL', 'MMA', 'OPED'];
const DEFAULT_HERO: HeroShape = {
  version: 2,
  eyebrow: 'SOFT LAUNCH',
  headline: "Sports from\nthe fan's view.\nNo BS.",
  sub: 'Opinion-led NFL, MLB, NHL, NBA, college football, soccer, and MMA — bias turned all the way up. Founded and edited by',
  cta_primary: { label: 'Read the takes', href: '/articles' },
  cta_secondary: { label: 'Get the newsletter', href: '/#newsletter' },
};

export default function SiteConfigEditor({ initial }: { initial: EditableSiteConfig }) {
  const [config, setConfig] = useState<EditableSiteConfig>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function save(key: keyof EditableSiteConfig, value: unknown) {
    setSaving(key);
    setError(null);
    setSavedKey(null);
    try {
      const res = await fetch('/api/admin/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Save failed');
      } else {
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(null);
    }
  }

  // ---------- breaking ticker editor ----------
  const ticker = config.breaking_ticker ?? [];
  function setTicker(next: BumpItem[]) {
    setConfig((c) => ({ ...c, breaking_ticker: next }));
  }

  // ---------- hero editor ----------
  const hero: HeroShape = config.hero?.version ? config.hero : DEFAULT_HERO;
  function setHero(next: HeroShape) {
    setConfig((c) => ({ ...c, hero: next }));
  }

  // ---------- about bio editor ----------
  const bio = config.about_bio ?? [];
  function setBio(next: string[]) {
    setConfig((c) => ({ ...c, about_bio: next }));
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="text-sm text-broadcast-red bg-broadcast-red/5 border border-broadcast-red/30 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      {/* === Breaking ticker === */}
      <section className="bg-white border border-navy/10 rounded p-5">
        <SectionHeader
          title="Breaking-news ticker"
          hint="Shown across the very top of every page."
          saving={saving === 'breaking_ticker'}
          saved={savedKey === 'breaking_ticker'}
          onSave={() => save('breaking_ticker', ticker)}
        />
        <div className="space-y-2 mt-4">
          {ticker.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={item.sport}
                onChange={(e) => {
                  const next = ticker.slice();
                  next[i] = { ...item, sport: e.target.value };
                  setTicker(next);
                }}
                className="border border-navy/20 rounded px-2 py-2 text-sm font-mono"
              >
                {SPORT_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <input
                type="text"
                value={item.text}
                onChange={(e) => {
                  const next = ticker.slice();
                  next[i] = { ...item, text: e.target.value };
                  setTicker(next);
                }}
                className="flex-1 border border-navy/20 rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setTicker(ticker.filter((_, j) => j !== i))}
                className="text-xs text-broadcast-red px-2"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTicker([...ticker, { sport: 'NFL', text: '' }])}
            className="text-xs text-navy/70 underline-offset-2 hover:underline"
          >
            + Add bumper
          </button>
        </div>
      </section>

      {/* === Hero === */}
      <section className="bg-white border border-navy/10 rounded p-5">
        <SectionHeader
          title="Homepage hero"
          hint="The big italic display section under the navigation."
          saving={saving === 'hero'}
          saved={savedKey === 'hero'}
          onSave={() => save('hero', { ...hero, version: 2 })}
        />
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <Labeled label="Eyebrow">
            <input className="w-full border border-navy/20 rounded px-3 py-2 text-sm font-mono uppercase tracking-[0.18em]"
              value={hero.eyebrow ?? ''} onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} />
          </Labeled>
          <Labeled label="Headline">
            <textarea className="w-full border border-navy/20 rounded px-3 py-2 text-sm font-display italic min-h-[84px]"
              value={hero.headline ?? ''} onChange={(e) => setHero({ ...hero, headline: e.target.value })} />
          </Labeled>
          <Labeled label="Sub-headline" full>
            <textarea className="w-full border border-navy/20 rounded px-3 py-2 text-sm min-h-[88px]"
              value={hero.sub ?? ''} onChange={(e) => setHero({ ...hero, sub: e.target.value })} />
          </Labeled>
          <Labeled label="CTA primary label">
            <input className="w-full border border-navy/20 rounded px-3 py-2 text-sm"
              value={hero.cta_primary?.label ?? ''}
              onChange={(e) => setHero({ ...hero, cta_primary: { ...(hero.cta_primary ?? {}), label: e.target.value } })} />
          </Labeled>
          <Labeled label="CTA primary href">
            <input className="w-full border border-navy/20 rounded px-3 py-2 text-sm font-mono"
              value={hero.cta_primary?.href ?? ''}
              onChange={(e) => setHero({ ...hero, cta_primary: { ...(hero.cta_primary ?? {}), href: e.target.value } })} />
          </Labeled>
          <Labeled label="CTA secondary label">
            <input className="w-full border border-navy/20 rounded px-3 py-2 text-sm"
              value={hero.cta_secondary?.label ?? ''}
              onChange={(e) => setHero({ ...hero, cta_secondary: { ...(hero.cta_secondary ?? {}), label: e.target.value } })} />
          </Labeled>
          <Labeled label="CTA secondary href">
            <input className="w-full border border-navy/20 rounded px-3 py-2 text-sm font-mono"
              value={hero.cta_secondary?.href ?? ''}
              onChange={(e) => setHero({ ...hero, cta_secondary: { ...(hero.cta_secondary ?? {}), href: e.target.value } })} />
          </Labeled>
        </div>
      </section>

      {/* === About bio === */}
      <section className="bg-white border border-navy/10 rounded p-5">
        <SectionHeader
          title="About-page bio"
          hint="Markdown paragraphs rendered safely on /about; raw HTML is ignored."
          saving={saving === 'about_bio'}
          saved={savedKey === 'about_bio'}
          onSave={() => save('about_bio', bio)}
        />
        <div className="space-y-2 mt-4">
          {bio.map((p, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                value={p}
                onChange={(e) => {
                  const next = bio.slice();
                  next[i] = e.target.value;
                  setBio(next);
                }}
                className="flex-1 border border-navy/20 rounded px-3 py-2 text-sm min-h-[80px]"
              />
              <button
                type="button"
                onClick={() => setBio(bio.filter((_, j) => j !== i))}
                className="text-xs text-broadcast-red self-start mt-2"
                title="Remove paragraph"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBio([...bio, ''])}
            className="text-xs text-navy/70 underline-offset-2 hover:underline"
          >
            + Add paragraph
          </button>
        </div>
      </section>

      {/* === Footer tagline === */}
      <section className="bg-white border border-navy/10 rounded p-5">
        <SectionHeader
          title="Footer tagline"
          hint="Short line under the BB Sports wordmark in the footer."
          saving={saving === 'footer_tagline'}
          saved={savedKey === 'footer_tagline'}
          onSave={() => save('footer_tagline', config.footer_tagline ?? '')}
        />
        <input
          className="w-full border border-navy/20 rounded px-3 py-2 text-sm mt-4"
          value={config.footer_tagline ?? ''}
          onChange={(e) => setConfig((c) => ({ ...c, footer_tagline: e.target.value }))}
        />
      </section>
    </div>
  );
}

function SectionHeader({ title, hint, saving, saved, onSave }: { title: string; hint?: string; saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-navy/10 pb-2">
      <div className="flex-1">
        <h2 className="font-serif font-bold text-navy text-lg">{title}</h2>
        {hint ? <p className="text-xs text-navy/60">{hint}</p> : null}
      </div>
      {saved ? (
        <span className="text-xs text-broadcast-red font-mono uppercase tracking-[0.2em]">Saved</span>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="bg-broadcast-red text-bone uppercase tracking-[0.18em] text-xs font-bold px-3 py-2 rounded hover:bg-broadcast-red/90 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function Labeled({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="block text-[11px] font-mono uppercase tracking-[0.18em] text-navy/60 mb-1">{label}</span>
      {children}
    </label>
  );
}
