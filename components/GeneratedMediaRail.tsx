import Image from 'next/image';
import { getMediaAssets, publicMediaUrl } from '@/lib/queries';

export default async function GeneratedMediaRail({
  placement,
  title = 'From the BB Sports media desk',
  limit = 4,
}: {
  placement?: string;
  title?: string;
  limit?: number;
}) {
  const assets = await getMediaAssets({ approved: true, placement, limit });
  if (assets.length === 0) return null;

  return (
    <section className="bg-bone-50 border-y border-navy/10">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="bb-eyebrow !text-breaking !tracking-[0.28em]">AI-assisted media</p>
            <h2 className="mt-1 font-display text-3xl italic text-navy">{title}</h2>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-navy/45 sm:inline">
            Approved by BB Sports
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assets.map((asset) => {
            const url = publicMediaUrl(asset);
            return (
              <figure key={asset.id} className="overflow-hidden rounded-sm border border-navy/15 bg-white">
                <div className="relative aspect-[16/10] overflow-hidden bg-navy/5">
                  {asset.kind === 'video' && url ? (
                    <video src={url} className="h-full w-full object-cover" autoPlay muted loop playsInline controls={false} />
                  ) : url ? (
                    <Image
                      src={url}
                      alt={asset.altText || asset.title}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover motion-safe:animate-[bb-media-drift_16s_ease-in-out_infinite_alternate]"
                    />
                  ) : null}
                </div>
                <figcaption className="p-3">
                  <div className="font-serif text-base font-bold leading-tight text-navy">{asset.title}</div>
                  <div className="mt-1 text-[11px] leading-4 text-charcoal/58">{asset.credit}</div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
