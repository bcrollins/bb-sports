import type { CommentStatus } from './comment-validation';

type ModerationResult = {
  status: CommentStatus;
  reason: string;
};

const SPAM_PATTERNS = [
  /free\s+(cash|money|picks?)/i,
  /\bcrypto\b/i,
  /\bcasino\b/i,
  /\bsportsbook\b/i,
  /\block\s+of\s+the\s+day\b/i,
  /\bguaranteed\s+(winner|pick)\b/i,
  /\btelegram\b/i,
];

const REVIEW_PATTERNS = [
  /\bidiot\b/i,
  /\btrash\b/i,
  /\bscam\b/i,
  /\bfraud\b/i,
  /\bfake\b/i,
];

export function moderateComment(body: string): ModerationResult {
  const text = body.trim();
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  if (links > 1) return { status: 'spam', reason: 'too_many_links' };
  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: 'spam', reason: 'spam_or_gambling_promo' };
  }
  if (REVIEW_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: 'flagged', reason: 'manual_review_keyword' };
  }
  if (text.length >= 24) {
    const letters = text.replace(/[^a-z]/gi, '');
    const caps = letters.replace(/[^A-Z]/g, '');
    if (letters.length >= 12 && caps.length / letters.length > 0.8) {
      return { status: 'flagged', reason: 'excessive_caps' };
    }
  }
  return { status: 'approved', reason: 'rules_clean' };
}

export const PUBLIC_COMMENT_MODERATION_RULES = {
  spamPatterns: SPAM_PATTERNS.map((pattern) => pattern.source),
  reviewPatterns: REVIEW_PATTERNS.map((pattern) => pattern.source),
  rateLimit: '5 comments per IP per 10 minutes',
};
