import Link from 'next/link';

/**
 * Canonical AI-assisted disclosure badge.
 * Always links to editorial standards so the provenance policy is one tap away.
 */
export default function AiAssistedBadge({
  className = '',
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark' | 'bone';
}) {
  const toneClass =
    tone === 'dark'
      ? '!bg-bone/15 !border-bone/30 !text-bone'
      : tone === 'bone'
        ? '!bg-bone/95'
        : '';

  return (
    <Link
      href="/editorial-standards#ai"
      className={`bb-ai-badge ${toneClass} ${className}`.trim()}
      title="AI-assisted draft, edited by Brad Benson — read the policy"
    >
      <span className="sr-only">AI-assisted draft, edited by Brad Benson. </span>
      AI · Brad-edited
    </Link>
  );
}
