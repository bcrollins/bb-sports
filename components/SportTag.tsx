import Link from 'next/link';
import { sportMeta } from '@/lib/sport-meta';
import type { SportSlug } from '@/lib/sports';

type Props = {
  sport: SportSlug;
  size?: 'xs' | 'sm' | 'md';
  asLink?: boolean;
  className?: string;
};

export default function SportTag({ sport, size = 'sm', asLink = true, className = '' }: Props) {
  const m = sportMeta(sport);
  const sizes: Record<string, string> = {
    xs: 'min-h-[20px] px-1.5 py-[1px] text-[9.5px] tracking-[0.2em]',
    sm: 'min-h-[24px] px-2 py-0.5 text-[10.5px] tracking-[0.22em]',
    md: 'min-h-[28px] px-3 py-1 text-[12px] tracking-[0.2em]'
  };
  const inner = (
    <span
      className={`inline-flex items-center justify-center font-black uppercase rounded-sm ${sizes[size]} ${className}`}
      style={{ backgroundColor: m.bg, color: m.fg }}
    >
      {m.short}
    </span>
  );
  if (!asLink) return inner;
  return (
    <Link href={`/articles?sport=${sport}`} aria-label={`More from ${m.label}`}>
      {inner}
    </Link>
  );
}
