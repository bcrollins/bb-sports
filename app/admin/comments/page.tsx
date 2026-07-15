import Link from 'next/link';
import { MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin-auth';
import { getAdminComments, getCommentModerationCounts } from '@/lib/queries';
import type { CommentStatus } from '@/lib/comment-validation';
import { CommentModerationActions } from './_components/CommentModerationActions';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<CommentStatus, string> = {
  approved: 'Approved',
  pending: 'Pending',
  flagged: 'Flagged',
  spam: 'Spam',
  hidden: 'Hidden',
};

export default async function AdminCommentsPage() {
  await requireAdminPage('/admin/comments');
  const [comments, counts] = await Promise.all([getAdminComments(), getCommentModerationCounts()]);
  const reviewCount = counts.pending + counts.flagged;

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/15 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">
          -- Community desk
        </p>
        <h1 className="font-display italic text-4xl mt-1">Comment moderation</h1>
        <p className="mt-1 max-w-2xl text-sm text-navy/70">
          Threaded article comments, first-party storage, public approvals only. Spam and review-keyword posts stay out of public view until Brad acts.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(STATUS_LABELS) as CommentStatus[]).map((status) => (
          <Stat key={status} label={STATUS_LABELS[status]} value={counts[status]} hot={status === 'pending' || status === 'flagged'} />
        ))}
      </section>

      <section className="rounded-xl border border-navy/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 px-5 py-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-navy">Queue</h2>
            <p className="text-sm text-navy/55">{reviewCount} comments need review.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            <ShieldCheck size={14} aria-hidden="true" /> Public renders approved only
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="p-6 text-sm text-navy/70">
            No comments recorded yet. Article threads will appear here after the first reader posts.
          </div>
        ) : (
          <div className="divide-y divide-navy/10">
            {comments.map((comment) => (
              <article key={comment.id} className="p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <Badge status={comment.status} />
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg font-bold text-navy">
                      {comment.authorName}
                      {comment.authorEmail ? (
                        <a className="ml-2 text-sm font-normal text-navy/55 underline-offset-2 hover:underline" href={`mailto:${comment.authorEmail}`}>
                          {comment.authorEmail}
                        </a>
                      ) : null}
                    </div>
                    <Link href={`/articles/${comment.articleSlug}#comments`} className="mt-0.5 block truncate text-sm font-semibold text-broadcast-red">
                      {comment.articleTitle}
                    </Link>
                  </div>
                  <time className="text-xs text-navy/50" dateTime={comment.createdAt.toISOString()}>
                    {comment.createdAt.toLocaleString()}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-charcoal/85">{comment.body}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-navy/55">
                  <span>Reason: {comment.moderationReason || 'manual'}</span>
                  {comment.parentId ? <span>Reply</span> : <span>Top-level</span>}
                  {comment.ipAddress ? <span>IP: {comment.ipAddress}</span> : null}
                </div>
                <CommentModerationActions id={comment.id} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className={`font-mono text-[11px] uppercase tracking-[0.25em] ${hot && value > 0 ? 'text-broadcast-red' : 'text-navy/55'}`}>
        {label}
      </p>
      <p className="mt-2 font-display text-5xl italic text-navy">{value}</p>
    </div>
  );
}

function Badge({ status }: { status: CommentStatus }) {
  const active = status === 'approved';
  const review = status === 'pending' || status === 'flagged';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : review
            ? 'bg-amber-50 text-amber-700'
            : 'bg-navy/10 text-navy/60'
      }`}
    >
      <MessageSquareWarning size={13} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
