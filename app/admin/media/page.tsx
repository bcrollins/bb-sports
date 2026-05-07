import { getMediaAssets } from '@/lib/queries';
import { serializeMediaAsset } from '@/lib/media-assets';
import { xaiProviderState } from '@/lib/xai-media';
import MediaStudio from './MediaStudio';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  const assets = await getMediaAssets({ limit: 48 });
  return (
    <div className="space-y-8">
      <header className="border-b border-navy/15 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          -- Grok media desk
        </p>
        <h1 className="font-display italic text-4xl mt-1">Generate media</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-navy/70">
          Create BB Sports-safe images and short motion clips for homepage modules, article heroes,
          social cards, newsletters, and brand assets. Nothing goes public until Bradley approves it.
        </p>
      </header>
      <MediaStudio initialAssets={assets.map(serializeMediaAsset)} provider={xaiProviderState()} />
    </div>
  );
}
