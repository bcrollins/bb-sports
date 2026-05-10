import Link from 'next/link';

export const metadata = {
  title: 'Videos',
  description: 'Short vertical clips and live game reactions from BB Sports. Coming this summer.'
};

const PLACEHOLDER_CLIPS = [
  { id: 1, title: 'Why the 9-6 hockey game was both great and bad', sport: 'NHL' },
  { id: 2, title: 'Bears schedule: the games I’m actually worried about', sport: 'NFL' },
  { id: 3, title: 'College football is a different sport now (and that’s fine)', sport: 'CFB' },
  { id: 4, title: 'The Manchester United takes rewriting themselves', sport: 'Soccer' }
];

export default function VideosPage() {
  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Video</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.92] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.25rem, 7vw, 5.5rem)' }}
          >
            Vertical clips.<br/>Live reactions.
          </h1>
          <p className="mt-4 text-lg text-bone/85 max-w-2xl">
            TikTok-format short video grid + live game reactions during major moments. Going live with the public launch this summer.
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {PLACEHOLDER_CLIPS.map((c) => (
            <div
              key={c.id}
              className="aspect-[9/16] bg-navy text-bone rounded overflow-hidden relative flex items-end p-3"
              aria-label={`Placeholder clip: ${c.title}`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/40 via-transparent to-navy-deep/85" />
              <div className="relative">
                <span className="bb-tag !bg-bone/20 !text-bone">{c.sport}</span>
                <h3 className="mt-2 font-serif font-bold text-bone leading-tight text-base">{c.title}</h3>
                <span className="text-[10px] uppercase tracking-[0.16em] text-bone/70">Coming this summer</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-white border border-navy/15 rounded p-6">
          <h2 className="font-serif text-2xl font-bold text-navy-900">Where the clips will live</h2>
          <p className="mt-2 text-charcoal/85">
            Cross-posted to <a className="bb-link" href="https://tiktok.com/@bbsports" target="_blank" rel="noopener">TikTok</a>,{' '}
            <a className="bb-link" href="https://instagram.com/bbsports" target="_blank" rel="noopener">Instagram</a>,{' '}
            <a className="bb-link" href="https://youtube.com/@bbsports" target="_blank" rel="noopener">YouTube Shorts</a>, and embedded on this page.
            Live game reactions stream on YouTube + the site, then archived as on-demand clips.
          </p>
          <p className="mt-3 text-sm text-charcoal/70">
            Want to see a specific clip? <Link href="/contact" className="bb-link">Pitch it.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
