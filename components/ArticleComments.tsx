'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MessageCircle, Reply, Send, ShieldCheck } from 'lucide-react';
import type { PublicComment } from '@/lib/queries';

type CommentNode = PublicComment & { replies: CommentNode[] };
type Status = 'loading' | 'ready' | 'error' | 'submitting' | 'success';

export default function ArticleComments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Loading comments...');
  const [commentsUnavailable, setCommentsUnavailable] = useState(false);
  const [replyTo, setReplyTo] = useState<PublicComment | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setStatus('loading');
      try {
        const res = await fetch(`/api/articles/${slug}/comments`, { cache: 'no-store' });
        const json = await res.json();
        if (!mounted) return;
        if (!res.ok) throw new Error(json.error || 'Comments unavailable.');
        setComments(Array.isArray(json.comments) ? json.comments : []);
        setCommentsUnavailable(false);
        setStatus('ready');
        setMessage('Comments loaded.');
      } catch (err) {
        if (!mounted) return;
        setCommentsUnavailable(true);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Comments unavailable.');
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const tree = useMemo(() => buildTree(comments), [comments]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('Sending comment...');
    try {
      const res = await fetch(`/api/articles/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: replyTo?.id ?? null,
          authorName,
          authorEmail: authorEmail || undefined,
          body,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Comment could not be saved.');
      if (json.comment) setComments((current) => [...current, json.comment]);
      setStatus('success');
      setMessage(json.message || 'Comment received.');
      setBody('');
      setReplyTo(null);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Comment could not be saved.');
    }
  }

  return (
    <section className="max-w-readable mx-auto px-4 sm:px-6 pb-10" id="comments">
      <div className="bb-thin-rule pb-3 mb-4 flex flex-wrap items-end gap-3">
        <span className="block h-7 w-1.5 bg-breaking" aria-hidden="true" />
        <h2 className="font-display uppercase italic text-navy-900 text-2xl tracking-[-0.01em] flex-1">
          Yell at me
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal/60">
          <ShieldCheck size={14} aria-hidden="true" /> Moderated
        </span>
      </div>

      <div className="rounded-sm border border-navy/15 bg-white">
        <div className="border-b border-navy/10 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-navy">
            <MessageCircle size={18} aria-hidden="true" />
            {commentsUnavailable ? 'Comments unavailable' : `${comments.length} approved ${comments.length === 1 ? 'comment' : 'comments'}`}
          </div>
          <p className="mt-1 text-sm leading-6 text-charcoal/75">
            Keep it about the take. Clean comments post fast; spam, gambling promos, and review-keyword comments go to the queue first.
          </p>
        </div>

        <div className="p-4 sm:p-5">
          {status === 'loading' ? (
            <div className="rounded border border-navy/10 bg-bone-50 p-4 text-sm text-navy/70">Loading the thread...</div>
          ) : commentsUnavailable ? (
            <div className="rounded border border-broadcast-red/25 bg-broadcast-red/5 p-4 text-sm text-broadcast-red">
              {message}
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded border border-navy/10 bg-bone-50 p-4 text-sm text-navy/70">
              No approved comments yet. First real argument gets the room.
            </div>
          ) : (
            <ol className="space-y-4">
              {tree.map((comment) => (
                <CommentItem key={comment.id} comment={comment} onReply={setReplyTo} />
              ))}
            </ol>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-navy/10 bg-bone-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-bold text-navy">{replyTo ? `Replying to ${replyTo.authorName}` : 'Add your take'}</h3>
            {replyTo ? (
              <button type="button" onClick={() => setReplyTo(null)} className="bb-link text-sm">
                Cancel reply
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="comment-name">
              <input
                id="comment-name"
                required
                minLength={2}
                maxLength={80}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="bb-admin-input"
                autoComplete="name"
                disabled={commentsUnavailable}
              />
            </Field>
            <Field label="Email (private)" htmlFor="comment-email">
              <input
                id="comment-email"
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                className="bb-admin-input"
                autoComplete="email"
                disabled={commentsUnavailable}
              />
            </Field>
          </div>

          <Field label="Comment" htmlFor="comment-body" className="mt-3">
            <textarea
              id="comment-body"
              required
              minLength={3}
              maxLength={1200}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="bb-admin-input min-h-[120px] resize-y"
              disabled={commentsUnavailable}
            />
          </Field>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className={`text-sm ${status === 'error' ? 'text-broadcast-red' : 'text-navy/65'}`}>
              {message}
            </p>
            <button type="submit" disabled={status === 'submitting' || commentsUnavailable} className="bb-button-primary inline-flex items-center justify-center gap-2 disabled:opacity-60">
              <Send size={16} aria-hidden="true" />
              {commentsUnavailable ? 'Comments unavailable' : status === 'submitting' ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function CommentItem({ comment, onReply }: { comment: CommentNode; onReply: (comment: PublicComment) => void }) {
  return (
    <li className="rounded border border-navy/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-serif text-lg font-bold text-navy">{comment.authorName}</div>
        <time className="text-xs text-navy/45" dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-charcoal/85">{comment.body}</p>
      <button type="button" onClick={() => onReply(comment)} className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-broadcast-red">
        <Reply size={14} aria-hidden="true" /> Reply
      </button>
      {comment.replies.length > 0 ? (
        <ol className="mt-4 space-y-3 border-l-2 border-navy/10 pl-3 sm:pl-5">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function Field({
  label,
  htmlFor,
  className = '',
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm font-semibold text-navy ${className}`} htmlFor={htmlFor}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function buildTree(comments: PublicComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const comment of comments) nodes.set(comment.id, { ...comment, replies: [] });
  for (const comment of nodes.values()) {
    if (comment.parentId && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId)?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }
  return roots;
}
