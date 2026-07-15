/** Explicit newsroom workflow. Publishing is intentionally not a state. */
export const NEWS_EVENT_STATES = [
  'new',
  'investigating',
  'verification_ready',
  'verified',
  'dismissed',
] as const;

export type NewsEventState = (typeof NEWS_EVENT_STATES)[number];

export const NEWS_URGENCIES = ['routine', 'watch', 'breaking'] as const;
export type NewsUrgency = (typeof NEWS_URGENCIES)[number];

const TRANSITIONS: Readonly<Record<NewsEventState, readonly NewsEventState[]>> = {
  new: ['investigating', 'verification_ready', 'dismissed'],
  investigating: ['verification_ready', 'dismissed'],
  verification_ready: ['investigating', 'verified', 'dismissed'],
  verified: ['investigating', 'dismissed'],
  dismissed: ['investigating'],
};

export function isNewsEventState(value: string): value is NewsEventState {
  return (NEWS_EVENT_STATES as readonly string[]).includes(value);
}

export function allowedNewsEventTransitions(state: NewsEventState): readonly NewsEventState[] {
  return TRANSITIONS[state];
}

export function canTransitionNewsEventState(
  from: NewsEventState,
  to: NewsEventState,
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Throws for an illegal workflow edge. Verification still has a separate
 * evidence gate; this function only establishes the state-machine contract.
 */
export function assertNewsEventTransition(
  from: NewsEventState,
  to: NewsEventState,
): void {
  if (!canTransitionNewsEventState(from, to)) {
    throw new Error(`Illegal newsroom event transition: ${from} -> ${to}`);
  }
}

/** New evidence always invalidates a previously verified snapshot. */
export function newsEventStateAfterEvidenceAdded(state: NewsEventState): NewsEventState {
  return state === 'verified' ? 'investigating' : state;
}
