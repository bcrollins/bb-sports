'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { CheckCircle2, Clipboard, Film, ImageIcon, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import {
  MEDIA_ASPECT_RATIOS,
  MEDIA_KINDS,
  MEDIA_PLACEMENTS,
  MEDIA_RESOLUTIONS,
} from '@/lib/media-validation';
import type { XaiProviderState } from '@/lib/xai-media';

interface MediaAssetView {
  id: string;
  kind: string;
  status: string;
  title: string;
  sport: string;
  placement: string;
  prompt: string;
  provider: string;
  model: string;
  assetUrl: string;
  externalUrl: string;
  contentType: string;
  altText: string;
  credit: string;
  aspectRatio: string;
  resolution: string;
  durationSeconds: number | null;
  animated: boolean;
  approved: boolean;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  kind: 'image' | 'video';
  placement: typeof MEDIA_PLACEMENTS[number];
  sport: string;
  title: string;
  brief: string;
  aspectRatio: typeof MEDIA_ASPECT_RATIOS[number];
  resolution: typeof MEDIA_RESOLUTIONS[number];
  durationSeconds: number;
  n: number;
  referenceImageUrl: string;
}

const DEFAULT_FORM: FormState = {
  kind: 'image',
  placement: 'homepage',
  sport: 'NHL',
  title: '',
  brief: 'Premium editorial art for a BB Sports NHL take: arena lights, ice texture, broadcast desk energy, Florida Panthers red/navy accents, no official logos.',
  aspectRatio: '16:9',
  resolution: '720p',
  durationSeconds: 8,
  n: 1,
  referenceImageUrl: '',
};

export default function MediaStudio({
  initialAssets,
  provider,
}: {
  initialAssets: MediaAssetView[];
  provider: XaiProviderState;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = provider.ready;
  const latestApproved = useMemo(() => assets.filter((a) => a.approved).length, [assets]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Generation failed');
        return;
      }
      const next = (data?.assets ?? []) as MediaAssetView[];
      setAssets((cur) => [...next, ...cur]);
      setMessage(form.kind === 'video' ? 'Video request started. Poll it from the library.' : 'Image generated and staged for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function updateAsset(id: string, patch: Partial<MediaAssetView>) {
    setError(null);
    const res = await fetch(`/api/admin/media/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? 'Update failed');
      return;
    }
    const updated = data.asset as MediaAssetView;
    setAssets((cur) => cur.map((a) => (a.id === id ? updated : a)));
  }

  async function pollAsset(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/media/${id}/poll`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? 'Poll failed');
      return;
    }
    const updated = data.asset as MediaAssetView;
    setAssets((cur) => cur.map((a) => (a.id === id ? updated : a)));
    setMessage(updated.status === 'ready' ? 'Video is ready for review.' : `Video status: ${updated.status}.`);
  }

  async function copy(text: string, label = 'Copied') {
    await navigator.clipboard?.writeText(text);
    setMessage(label);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-9 w-9 place-items-center rounded-lg ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {ready ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            </span>
            <div>
              <h2 className="font-serif text-xl font-bold text-navy">xAI Grok provider</h2>
              <p className="mt-1 text-sm leading-6 text-navy/65">
                {ready
                  ? `Ready. Images use ${provider.imageModel}; motion uses ${provider.videoModel}.`
                  : 'Configured UI is live, but generation is disabled until production has the approved xAI key.'}
              </p>
              {!ready ? (
                <div className="mt-3 grid gap-1 rounded-lg bg-amber-50 p-3 font-mono text-[11px] text-amber-800">
                  <span>XAI_API_KEY: {provider.hasKey ? 'present' : 'missing'}</span>
                  <span>BBSPORTS_APPROVED_XAI: {provider.approved ? 'true' : 'missing'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <form onSubmit={generate} className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-navy/10 pb-3">
            <Sparkles size={18} className="text-broadcast-red" />
            <h2 className="font-serif text-xl font-bold text-navy">Generate new media</h2>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Type">
              <div className="grid grid-cols-2 gap-2">
                {MEDIA_KINDS.map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    onClick={() => setField('kind', kind)}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold capitalize ${
                      form.kind === kind ? 'border-broadcast-red bg-broadcast-red text-bone' : 'border-navy/15 text-navy hover:border-navy'
                    }`}
                  >
                    {kind === 'image' ? <ImageIcon size={16} /> : <Film size={16} />}
                    {kind}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Placement">
                <select value={form.placement} onChange={(e) => setField('placement', e.target.value as FormState['placement'])} className="bb-admin-input">
                  {MEDIA_PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Sport/context">
                <input value={form.sport} onChange={(e) => setField('sport', e.target.value)} className="bb-admin-input" />
              </Field>
            </div>

            <Field label="Title">
              <input value={form.title} onChange={(e) => setField('title', e.target.value)} className="bb-admin-input" placeholder="Optional internal title" />
            </Field>

            <Field label="Creative brief">
              <textarea value={form.brief} onChange={(e) => setField('brief', e.target.value)} rows={6} className="bb-admin-input leading-6" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Aspect">
                <select value={form.aspectRatio} onChange={(e) => setField('aspectRatio', e.target.value as FormState['aspectRatio'])} className="bb-admin-input">
                  {MEDIA_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
                </select>
              </Field>
              <Field label="Count">
                <input type="number" min={1} max={4} value={form.n} disabled={form.kind === 'video'} onChange={(e) => setField('n', Number(e.target.value))} className="bb-admin-input disabled:bg-navy/5" />
              </Field>
            </div>

            {form.kind === 'video' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Resolution">
                  <select value={form.resolution} onChange={(e) => setField('resolution', e.target.value as FormState['resolution'])} className="bb-admin-input">
                    {MEDIA_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Seconds">
                  <input type="number" min={1} max={15} value={form.durationSeconds} onChange={(e) => setField('durationSeconds', Number(e.target.value))} className="bb-admin-input" />
                </Field>
                <Field label="Reference image URL">
                  <input type="url" value={form.referenceImageUrl} onChange={(e) => setField('referenceImageUrl', e.target.value)} className="bb-admin-input" placeholder="Optional public image URL" />
                </Field>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-broadcast-red px-4 text-sm font-black uppercase tracking-[0.18em] text-bone disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
              {form.kind === 'video' ? 'Start motion' : 'Generate image'}
            </button>
          </div>
        </form>

        <section className="rounded-xl border border-navy/10 bg-navy p-5 text-bone shadow-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-bone/55">Approval discipline</p>
          <p className="mt-2 text-sm leading-6 text-bone/80">
            Generated assets are staged only. Approve after checking source safety, no protected marks,
            useful alt text, and whether the image actually fits Brad&rsquo;s voice.
          </p>
          <p className="mt-3 font-display text-4xl italic">{latestApproved}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-bone/50">approved assets</p>
        </section>
      </aside>

      <section className="space-y-4">
        {(error || message) ? (
          <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-broadcast-red/30 bg-broadcast-red/5 text-broadcast-red' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {error ?? message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {assets.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm">
              <div className="relative aspect-video bg-navy/5">
                {asset.kind === 'video' && asset.assetUrl ? (
                  <video src={asset.assetUrl} className="h-full w-full object-cover" controls muted loop playsInline />
                ) : asset.assetUrl ? (
                  <Image
                    src={asset.assetUrl}
                    alt={asset.altText || asset.title}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 28vw, (min-width: 768px) 42vw, 90vw"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-navy/45">{asset.status}</div>
                )}
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                  asset.approved ? 'bg-emerald-500 text-white' : 'bg-white/90 text-navy'
                }`}>
                  {asset.approved ? 'Approved' : asset.status}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <div className="font-serif text-lg font-bold leading-tight text-navy">{asset.title || 'Untitled media'}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-navy/45">
                    {asset.kind} / {asset.placement} / {asset.aspectRatio}
                  </div>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-charcoal/65">{asset.prompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateAsset(asset.id, { approved: !asset.approved })} className="bb-admin-button">
                    {asset.approved ? 'Unapprove' : 'Approve'}
                  </button>
                  {asset.kind === 'video' && asset.status !== 'ready' ? (
                    <button type="button" onClick={() => pollAsset(asset.id)} className="bb-admin-button">
                      <RefreshCw size={14} /> Poll
                    </button>
                  ) : null}
                  {asset.assetUrl ? (
                    <button type="button" onClick={() => copy(asset.assetUrl, 'Asset URL copied')} className="bb-admin-button">
                      <Clipboard size={14} /> URL
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => copy(`Hero: ${asset.assetUrl}\nAlt: ${asset.altText}\nCredit: ${asset.credit}`, 'Hero fields copied')}
                    className="bb-admin-button"
                  >
                    Hero packet
                  </button>
                </div>
              </div>
            </article>
          ))}
          {assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-sm text-navy/60">
              No media assets yet. Generate one after xAI is configured.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.2em] text-navy/58">{label}</span>
      {children}
    </div>
  );
}
