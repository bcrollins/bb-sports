import Link from 'next/link';

type Props = {
  variant?: 'mark' | 'wordmark' | 'lockup' | 'masthead';
  scheme?: 'navy-on-bone' | 'bone-on-navy' | 'red-bug';
  className?: string;
  asLink?: boolean;
};

/**
 * BB Sports — broadcast-grade identity.
 *
 * The visual system intentionally borrows the *grammar* of network sports
 * branding (ESPN bug-on-a-rule, Sky Sports condensed italic, Fox Sports
 * angular cut, NBC serif gravitas) and synthesises it into a mark that's
 * unmistakably BB Sports:
 *
 *   1. A square "bug" with a stacked italic BB monogram. Navy background,
 *      bone glyphs, a red rule for accent. Reads at favicon scale.
 *   2. A condensed black italic "BB SPORTS" wordmark in Anton + Inter all-caps
 *      — the same condensed-italic register Sky Sports / Fox Sports use.
 *   3. Horizontal red rule under the wordmark as a permanent network cue —
 *      the way ESPN's red bar lives under the shield.
 *
 * Variants:
 *   - mark      → just the square bug, ideal for favicons / avatars
 *   - wordmark  → just the typeset wordmark (no bug)
 *   - lockup    → bug + wordmark side-by-side, for headers
 *   - masthead  → oversized centred wordmark with double rule, for hero use
 */
export default function Logo({
  variant = 'lockup',
  scheme = 'navy-on-bone',
  className = '',
  asLink = false
}: Props) {
  const fg = scheme === 'bone-on-navy' ? '#F5F2EC' : '#0A1F44';
  const accent = '#D7263D';
  const bugBg = scheme === 'bone-on-navy' ? '#F5F2EC' : scheme === 'red-bug' ? accent : '#0A1F44';
  const bugFg = scheme === 'bone-on-navy' ? '#0A1F44' : scheme === 'red-bug' ? '#F5F2EC' : '#F5F2EC';

  const Mark = (
    <span
      role="img"
      aria-label="BB Sports monogram"
      className="inline-flex items-center justify-center select-none"
      style={{ width: '1em', height: '1em' }}
    >
      <svg
        viewBox="0 0 80 80"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <rect x="0" y="0" width="80" height="80" rx="6" fill={bugBg} />
        {/* Two B's stacked — Anton-style condensed italic monogram.
            Font references the next/font CSS variable (set on <html> in
            app/layout.tsx) with system fallbacks so the SVG still renders
            if the font hasn't loaded yet. */}
        <g
          fontFamily="var(--font-anton), var(--font-oswald), var(--font-inter), system-ui, sans-serif"
          fontStyle="italic"
          fontWeight="900"
          fill={bugFg}
          textAnchor="middle"
        >
          <text x="42" y="50" fontSize="56" letterSpacing="-3">BB</text>
        </g>
        {/* Network red rule */}
        <rect x="14" y="60" width="52" height="3.5" fill={accent} />
      </svg>
    </span>
  );

  const Wordmark = (
    <span
      className="font-display uppercase italic leading-[0.85] whitespace-nowrap tracking-[-0.01em]"
      style={{
        color: fg,
        // font-family flows from the `font-display` Tailwind token, which
        // resolves to var(--font-anton). Inline override removed so the
        // CSS variable cascade works even before next/font hydrates.
        fontWeight: 400, // Anton ships at one weight
      }}
    >
      <span aria-hidden="true">BB&nbsp;SPORTS</span>
      <span className="sr-only">BB Sports</span>
    </span>
  );

  let body: React.ReactNode = null;

  if (variant === 'mark') {
    body = (
      <span className={`inline-block ${className}`} style={{ width: '1em', height: '1em', fontSize: '2em' }}>
        {Mark}
      </span>
    );
  } else if (variant === 'wordmark') {
    body = (
      <span className={`inline-flex flex-col ${className}`}>
        <span className="text-[2.4em]">{Wordmark}</span>
        <span className="h-[3px] mt-1.5 self-stretch" style={{ background: accent }} aria-hidden="true" />
      </span>
    );
  } else if (variant === 'masthead') {
    body = (
      <span className={`inline-flex flex-col items-center ${className}`}>
        <span className="h-[3px] w-[88%] mb-2" style={{ background: accent }} aria-hidden="true" />
        <span style={{ fontSize: 'clamp(2.5rem, 11vw, 8.5rem)' }}>{Wordmark}</span>
        <span className="h-[3px] w-[88%] mt-2" style={{ background: accent }} aria-hidden="true" />
      </span>
    );
  } else {
    // lockup
    body = (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <span className="block" style={{ width: '2em', height: '2em', fontSize: '1em' }}>
          {Mark}
        </span>
        <span className="inline-flex flex-col">
          <span className="text-[1.7em]">{Wordmark}</span>
          <span className="h-[2.5px] mt-1" style={{ background: accent }} aria-hidden="true" />
        </span>
      </span>
    );
  }

  if (asLink) {
    return (
      <Link href="/" aria-label="BB Sports — home" className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-breaking">
        {body}
      </Link>
    );
  }
  return body;
}
