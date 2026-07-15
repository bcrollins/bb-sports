'use client';

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

type EventState = 'new' | 'investigating' | 'verification_ready' | 'verified' | 'dismissed';
type Urgency = 'routine' | 'watch' | 'breaking';
type ConnectionMode = 'connecting' | 'live' | 'polling' | 'degraded' | 'manual';

type SerializedNewsEvent = {
  id: string;
  headline: string;
  summary: string;
  sport: string;
  state: EventState;
  urgency: Urgency;
  version: number;
  firstSignalAt: string;
  lastSignalAt: string;
  createdAt: string;
  updatedAt: string;
};

type SerializedNewsSource = {
  id: string;
  sourceKey: string;
  displayName: string;
  sourceType: string;
  ownerKey: string;
  tier: 'primary' | 'official' | 'tier_1' | 'tier_2' | 'unverified';
  commercialStatus: string;
  commercialNotes: string;
  homepageUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SerializedActivity = {
  sequence: number;
  eventId: string | null;
  signalId: string | null;
  action: string;
  actorLabel: string;
  fromState: string | null;
  toState: string | null;
  summary: string;
  createdAt: string;
};

type SerializedProviderDeskStatus = {
  providerKey: string;
  displayName: string;
  commercialStatus: string;
  configEnabled: boolean;
  credentialPresence: string;
  operationalLabel: 'inactive' | 'degraded' | 'live';
  transportAllowed: false;
  blockers: string[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureSummary: string;
  leaseHeld: boolean;
  leaseExpiresAt: string | null;
};

type SerializedProviderStatusSummary = {
  deskSourcesLabel: 'Manual only' | 'Monitoring configured' | 'Live monitoring' | 'Degraded monitoring';
  openDeadLetters: number;
  providers: SerializedProviderDeskStatus[];
};

export type SerializedNewsroomSnapshot = {
  generatedAt: string;
  latestActivitySeq: number;
  counts: Record<EventState, number> & { breaking: number };
  events: SerializedNewsEvent[];
  sources: SerializedNewsSource[];
  recentActivity: SerializedActivity[];
  providerStatus?: SerializedProviderStatusSummary;
};

type SerializedSignal = {
  id: string;
  sourceId: string;
  externalId: string | null;
  canonicalUrl: string | null;
  headline: string;
  summary: string;
  sport: string;
  sourcePublishedAt: string | null;
  observedAt: string;
  createdAt: string;
};

type SerializedEvidence = {
  id: string;
  eventId: string;
  sourceId: string | null;
  signalId: string | null;
  supersedesEvidenceId: string | null;
  stance: 'supporting' | 'contradicting' | 'context';
  evidenceClass: 'primary' | 'official' | 'reporting' | 'context';
  ownerKey: string;
  sourceTier: SerializedNewsSource['tier'];
  credible: boolean;
  label: string;
  url: string | null;
  excerpt: string;
  notes: string;
  capturedAt: string;
  createdAt: string;
};

type SerializedReview = {
  id: string;
  eventId: string;
  reviewerLabel: string;
  decision: string;
  rationale: string;
  eventVersion: number;
  criteriaSnapshot: unknown;
  createdAt: string;
};

type SerializedEventSnapshot = {
  event: SerializedNewsEvent;
  signals: SerializedSignal[];
  evidence: SerializedEvidence[];
  reviews: SerializedReview[];
  activity: SerializedActivity[];
};

const STATE_LABELS: Record<EventState, string> = {
  new: 'Incoming',
  investigating: 'Investigating',
  verification_ready: 'Ready to verify',
  verified: 'Verified',
  dismissed: 'Dismissed',
};

const CONNECTION_COPY: Record<ConnectionMode, { label: string; detail: string; style: string }> = {
  connecting: { label: 'Desk connecting', detail: 'Opening activity stream', style: 'bg-navy/10 text-navy' },
  live: { label: 'Desk live', detail: 'Activity stream connected', style: 'bg-emerald-100 text-emerald-800' },
  polling: { label: 'Desk polling', detail: '5-second fallback', style: 'bg-amber-100 text-amber-900' },
  degraded: { label: 'Desk degraded', detail: 'Refresh is failing', style: 'bg-red-100 text-red-800' },
  manual: { label: 'Desk manual', detail: 'Browser is offline', style: 'bg-slate-200 text-slate-800' },
};

const INPUT =
  'min-h-11 w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-broadcast-red focus:ring-2 focus:ring-broadcast-red/20 disabled:bg-navy/5';
const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-navy/20 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition hover:border-navy/50 focus:outline-none focus:ring-2 focus:ring-broadcast-red/40 disabled:cursor-not-allowed disabled:opacity-50';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
  };
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload.data;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-navy">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="text-xs font-normal text-navy/55">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function EventCard({ event, onSelect }: { event: SerializedNewsEvent; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="min-h-11 w-full rounded-xl border border-navy/10 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-broadcast-red/40"
      aria-label={`Open ${event.headline}`}
    >
      <span className="mb-2 flex flex-wrap items-center gap-2">
        {event.urgency === 'breaking' ? (
          <span className="rounded-full bg-broadcast-red px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            Breaking
          </span>
        ) : null}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy/55">
          {event.sport} · {STATE_LABELS[event.state]}
        </span>
      </span>
      <span className="block font-serif text-base font-bold leading-snug text-navy-deep">
        {event.headline}
      </span>
      {event.summary ? (
        <span className="mt-2 block line-clamp-2 text-xs leading-5 text-charcoal/70">{event.summary}</span>
      ) : null}
      <span className="mt-3 flex items-center gap-1.5 text-[11px] text-navy/50">
        <Clock3 aria-hidden="true" size={13} />
        <time dateTime={event.lastSignalAt}>{formatTime(event.lastSignalAt)}</time>
      </span>
    </button>
  );
}

function DeskColumn({
  title,
  subtitle,
  events,
  onSelect,
}: {
  title: string;
  subtitle: string;
  events: SerializedNewsEvent[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-navy/10 bg-bone-50/70 p-3" aria-label={title}>
      <header className="mb-3 flex items-start justify-between gap-3 px-1 pt-1">
        <div>
          <h2 className="font-display text-xl uppercase tracking-tight text-navy-deep">{title}</h2>
          <p className="mt-0.5 text-xs text-navy/55">{subtitle}</p>
        </div>
        <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-navy text-xs font-black text-white">
          {events.length}
        </span>
      </header>
      <div className="space-y-3">
        {events.length ? (
          events.map((event) => (
            <EventCard key={event.id} event={event} onSelect={() => onSelect(event.id)} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-navy/20 px-4 py-10 text-center">
            <CheckCircle2 className="mx-auto text-navy/25" aria-hidden="true" size={24} />
            <p className="mt-2 text-sm font-semibold text-navy/60">Nothing in this lane</p>
          </div>
        )}
      </div>
    </section>
  );
}

const EMPTY_LEAD = { headline: '', summary: '', canonicalUrl: '', sport: 'General', urgency: 'routine', sourcePublishedAt: '' };
const EMPTY_EVIDENCE = {
  sourceId: '',
  signalId: '',
  supersedesEvidenceId: '',
  stance: 'supporting',
  evidenceClass: 'reporting',
  ownerKey: '',
  sourceTier: 'tier_2',
  credible: true,
  label: '',
  url: '',
  excerpt: '',
  notes: '',
};

export default function NewsDesk({
  initialSnapshot,
  automationEnabled,
}: {
  initialSnapshot: SerializedNewsroomSnapshot;
  automationEnabled: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] = useState<ConnectionMode>(
    automationEnabled ? 'connecting' : 'manual',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [mobileLane, setMobileLane] = useState<'incoming' | 'verify' | 'ready'>('incoming');
  const [lead, setLead] = useState(EMPTY_LEAD);
  const [leadBusy, setLeadBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SerializedEventSnapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [evidence, setEvidence] = useState(EMPTY_EVIDENCE);
  const [verifyRationale, setVerifyRationale] = useState('');
  const [dismissRationale, setDismissRationale] = useState('');
  const [mutationBusy, setMutationBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'unknown' | NotificationPermission | 'unsupported'>('unknown');
  const selectedRef = useRef<string | null>(null);
  const failuresRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const notifiedRef = useRef(new Set(initialSnapshot.events.filter((event) => event.urgency === 'breaking').map((event) => event.id)));

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setDetailLoading(true);
    setDetailError('');
    try {
      const next = await requestData<SerializedEventSnapshot>(`/api/admin/news-desk/events/${id}`);
      if (selectedRef.current === id) setDetail(next);
      return next;
    } catch (error) {
      if (selectedRef.current === id) setDetailError(error instanceof Error ? error.message : 'Could not load event details.');
      return null;
    } finally {
      if (!quiet && selectedRef.current === id) setDetailLoading(false);
    }
  }, []);

  const refreshSnapshot = useCallback(async (quiet = false, notifyEventId?: string | null) => {
    if (!quiet) setRefreshing(true);
    try {
      const next = await requestData<SerializedNewsroomSnapshot>('/api/admin/news-desk');
      setSnapshot(next);
      failuresRef.current = 0;
      setGlobalError('');
      if ('Notification' in window && Notification.permission === 'granted') {
        // Scan the snapshot, not only the SSE hint. This preserves breaking
        // alerts when EventSource is unavailable and the desk is on its
        // five-second polling fallback. The initial snapshot is pre-marked as
        // seen, so reconnects and duplicate activity never create an alert
        // storm.
        const breakingEvents = next.events.filter((event) => event.urgency === 'breaking');
        if (notifyEventId) {
          breakingEvents.sort((left, right) =>
            left.id === notifyEventId ? -1 : right.id === notifyEventId ? 1 : 0,
          );
        }
        for (const event of breakingEvents) {
          if (notifiedRef.current.has(event.id)) continue;
          notifiedRef.current.add(event.id);
          try {
            new Notification('BB Sports breaking lead', { body: event.headline, tag: event.id });
          } catch {
            // Some mobile browsers expose Notification but still refuse the
            // constructor outside an installed web app. The fresh lead remains
            // visible in the desk; never let a platform alert failure break
            // synchronization.
          }
        }
      }
      return next;
    } catch (error) {
      failuresRef.current += 1;
      const message = error instanceof Error ? error.message : 'The desk could not refresh.';
      if (!quiet) setGlobalError(message);
      setConnection(navigator.onLine ? 'degraded' : 'manual');
      return null;
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setEvidence(EMPTY_EVIDENCE);
    setVerifyRationale('');
    setDismissRationale('');
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedId(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('hidden'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [selectedId]);

  useEffect(() => {
    if (!automationEnabled) {
      setConnection('manual');
      return;
    }
    if (!('EventSource' in window)) {
      setConnection('polling');
      return;
    }
    const source = new EventSource(`/api/admin/news-desk/stream?after=${initialSnapshot.latestActivitySeq}`);
    const activityNames = [
      'signal.created',
      'signal.deduplicated',
      'evidence.added',
      'event.state_changed',
      'event.updated',
      'event.verified',
      'event.verification_failed',
      'event.dismissed',
    ];
    const onActivity = (rawEvent: Event) => {
      const message = rawEvent as MessageEvent<string>;
      let eventId: string | null = null;
      try {
        eventId = (JSON.parse(message.data) as { eventId?: string | null }).eventId ?? null;
      } catch {
        // A malformed alert triggers a safe refresh without using its payload.
      }
      void refreshSnapshot(true, eventId).then(() => {
        if (selectedRef.current) void loadDetail(selectedRef.current, true);
      });
    };
    source.onopen = () => {
      failuresRef.current = 0;
      setConnection('live');
    };
    source.onerror = () => setConnection(navigator.onLine ? 'polling' : 'manual');
    for (const name of activityNames) source.addEventListener(name, onActivity);
    source.addEventListener('stream_error', onActivity);
    return () => {
      for (const name of activityNames) source.removeEventListener(name, onActivity);
      source.removeEventListener('stream_error', onActivity);
      source.close();
    };
  }, [automationEnabled, initialSnapshot.latestActivitySeq, loadDetail, refreshSnapshot]);

  useEffect(() => {
    if (connection === 'live' || connection === 'connecting' || connection === 'manual') return;
    const poll = async () => {
      const next = await refreshSnapshot(true);
      if (next) setConnection((current) => (current === 'live' ? current : 'polling'));
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 5_000);
    return () => window.clearInterval(interval);
  }, [connection, refreshSnapshot]);

  useEffect(() => {
    const offline = () => setConnection('manual');
    const online = () => setConnection(automationEnabled ? 'polling' : 'manual');
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [automationEnabled]);

  const lanes = useMemo(() => ({
    incoming: snapshot.events.filter((event) => event.state === 'new'),
    verify: snapshot.events.filter((event) => event.state === 'investigating' || event.state === 'verification_ready'),
    ready: snapshot.events.filter((event) => event.state === 'verified'),
  }), [snapshot.events]);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadBusy(true);
    setGlobalError('');
    setNotice('');
    try {
      const result = await requestData<{ created: boolean; deduplicated: boolean; event: SerializedNewsEvent }>(
        '/api/admin/news-desk/signals',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline: lead.headline,
            summary: lead.summary,
            sport: lead.sport,
            urgency: lead.urgency,
            ...(lead.canonicalUrl ? { canonicalUrl: lead.canonicalUrl } : {}),
            ...(lead.sourcePublishedAt ? { sourcePublishedAt: new Date(lead.sourcePublishedAt).toISOString() } : {}),
          }),
        },
      );
      setNotice(result.deduplicated ? 'Matched an existing lead; no duplicate was created.' : 'Lead added to Incoming.');
      setLead(EMPTY_LEAD);
      setManualOpen(false);
      await refreshSnapshot(true);
      setSelectedId(result.event.id);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'The lead could not be added.');
    } finally {
      setLeadBusy(false);
    }
  }

  async function mutate(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>, success: string): Promise<boolean> {
    if (!detail) return false;
    setMutationBusy(true);
    setDetailError('');
    try {
      await requestData(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNotice(success);
      await refreshSnapshot(true);
      await loadDetail(detail.event.id, true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The change could not be saved.';
      await loadDetail(detail.event.id, true);
      setDetailError(message);
      return false;
    } finally {
      setMutationBusy(false);
    }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const saved = await mutate(
      `/api/admin/news-desk/events/${detail.event.id}/evidence`,
      'POST',
      {
        stance: evidence.stance,
        evidenceClass: evidence.evidenceClass,
        ownerKey: evidence.ownerKey,
        sourceTier: evidence.sourceTier,
        credible: evidence.credible,
        label: evidence.label,
        ...(evidence.sourceId ? { sourceId: evidence.sourceId } : {}),
        ...(evidence.signalId ? { signalId: evidence.signalId } : {}),
        ...(evidence.supersedesEvidenceId
          ? { supersedesEvidenceId: evidence.supersedesEvidenceId }
          : {}),
        ...(evidence.url ? { url: evidence.url } : {}),
        excerpt: evidence.excerpt,
        notes: evidence.notes,
      },
      'Evidence recorded and the verification basis recalculated.',
    );
    if (saved) setEvidence(EMPTY_EVIDENCE);
  }

  async function createArticleDraft() {
    if (!detail || detail.event.state !== 'verified') return;
    setMutationBusy(true);
    setDetailError('');
    try {
      const result = await requestData<{
        created: boolean;
        articleId: string;
        articleTitle: string;
        articleSlug: string;
        revisionId: string;
        contentHash: string;
      }>(`/api/admin/news-desk/events/${detail.event.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setNotice(
        result.created
          ? 'Verified evidence became a reviewable article draft.'
          : 'This event already has a reviewable article draft.',
      );
      window.location.assign(`/admin/articles/${encodeURIComponent(result.articleId)}/edit`);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : 'The article draft could not be created.',
      );
      await loadDetail(detail.event.id, true);
    } finally {
      setMutationBusy(false);
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(permission === 'granted' ? 'Breaking-lead browser alerts are on.' : 'Browser alerts were not enabled.');
  }

  const connectionCopy = connection === 'manual' && !automationEnabled
    ? { ...CONNECTION_COPY.manual, detail: 'Activity stream off' }
    : CONNECTION_COPY[connection];
  const mobileEvents = lanes[mobileLane];
  const supersededEvidenceIds = new Set(
    detail?.evidence
      .map((item) => item.supersedesEvidenceId)
      .filter((id): id is string => Boolean(id)) ?? [],
  );

  return (
    <div className="space-y-5 pb-12">
      <header className="rounded-2xl bg-navy-deep px-5 py-5 text-white shadow-lg sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/65">
              <Radio size={15} aria-hidden="true" /> BB Sports newsroom
            </p>
            <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-white sm:text-4xl">Live Desk</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">
              Capture fast-moving leads, document independent evidence, and enforce a human verification gate.
            </p>
            <p className="mt-2 text-xs font-semibold text-amber-200">
              Sources: {snapshot.providerStatus?.deskSourcesLabel ?? 'Manual only'}
              {snapshot.providerStatus?.deskSourcesLabel === 'Live monitoring'
                ? ' · external monitoring has recent worker success evidence'
                : ' · external X, Bluesky, and RSS monitoring is not active'}
              {snapshot.providerStatus && snapshot.providerStatus.openDeadLetters > 0
                ? ` · ${snapshot.providerStatus.openDeadLetters} open dead letter${snapshot.providerStatus.openDeadLetters === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`min-h-11 rounded-lg px-3 py-2 ${connectionCopy.style}`} aria-live="polite">
              <p className="text-xs font-black uppercase tracking-[0.14em]">{connectionCopy.label}</p>
              <p className="text-[10px] opacity-75">{connectionCopy.detail}</p>
            </div>
            <button type="button" className={`${BUTTON} border-white/25 text-white hover:border-white/60`} disabled={notificationPermission === 'unsupported' || notificationPermission === 'denied'} onClick={() => void requestNotifications()}>
              <Bell size={15} aria-hidden="true" />
              {notificationPermission === 'granted' ? 'Alerts on' : notificationPermission === 'denied' ? 'Alerts blocked' : notificationPermission === 'unsupported' ? 'Alerts unavailable' : 'Breaking alerts'}
            </button>
            <button type="button" className={`${BUTTON} border-white/25 text-white hover:border-white/60`} disabled={refreshing} onClick={() => void refreshSnapshot()}>
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
            </button>
          </div>
        </div>
      </header>

      {snapshot.providerStatus && snapshot.providerStatus.providers.length > 0 ? (
        <section
          className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm"
          aria-label="External provider status"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-navy/50">
                External providers
              </p>
              <p className="mt-1 text-sm text-navy/70">
                Configuration and lease posture only. A green commercial flag is not a live feed.
              </p>
            </div>
            <p className="rounded-full bg-ink/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-navy/70">
              {snapshot.providerStatus.deskSourcesLabel}
            </p>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {snapshot.providerStatus.providers.map((provider) => {
              const label =
                provider.operationalLabel === 'live'
                  ? 'Live'
                  : provider.operationalLabel === 'degraded'
                    ? 'Degraded'
                    : 'Inactive';
              const tone =
                provider.operationalLabel === 'live'
                  ? 'bg-green-100 text-green-900'
                  : provider.operationalLabel === 'degraded'
                    ? 'bg-amber-100 text-amber-950'
                    : 'bg-ink/5 text-navy/70';
              return (
                <li
                  key={provider.providerKey}
                  className="rounded-xl border border-navy/10 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-navy-deep">{provider.displayName}</p>
                      <p className="text-[11px] text-navy/55">{provider.providerKey}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${tone}`}>
                      {label}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-navy/70">
                    <div>
                      <dt className="font-semibold text-navy/45">Commercial</dt>
                      <dd>{provider.commercialStatus}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-navy/45">Config</dt>
                      <dd>{provider.configEnabled ? 'enabled' : 'disabled'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-navy/45">Credentials</dt>
                      <dd>{provider.credentialPresence}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-navy/45">Lease</dt>
                      <dd>{provider.leaseHeld ? 'held' : 'none'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-semibold text-navy/45">Last success</dt>
                      <dd>{provider.lastSuccessAt ? new Date(provider.lastSuccessAt).toLocaleString() : 'never'}</dd>
                    </div>
                    {provider.blockers.length > 0 ? (
                      <div className="col-span-2">
                        <dt className="font-semibold text-navy/45">Blockers</dt>
                        <dd className="break-words">{provider.blockers.join(', ')}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-navy/40">
                    transportAllowed: false
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Desk totals">
        {[
          ['Incoming', snapshot.counts.new],
          ['In verification', snapshot.counts.investigating + snapshot.counts.verification_ready],
          ['Verified', snapshot.counts.verified],
          ['Breaking', snapshot.counts.breaking],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-navy/10 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-navy/50">{label}</p>
            <p className="mt-1 font-display text-2xl text-navy-deep">{value}</p>
          </div>
        ))}
      </div>

      <div className="min-h-6" aria-live="polite" aria-atomic="true">
        {globalError ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><AlertTriangle className="mr-2 inline" size={16} aria-hidden="true" />{globalError}</p> : null}
        {!globalError && notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      </div>

      <section className="rounded-2xl border border-navy/10 bg-white shadow-sm">
        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-broadcast-red/40" onClick={() => setManualOpen((open) => !open)} aria-expanded={manualOpen}>
          <span>
            <span className="block text-sm font-black uppercase tracking-[0.14em] text-navy"><Plus className="mr-2 inline" size={16} aria-hidden="true" />Add a manual lead</span>
            <span className="mt-1 block text-xs text-navy/55">Use a source URL when available; duplicate URLs and exact text are reconciled.</span>
          </span>
          <span className="text-xl text-navy/50" aria-hidden="true">{manualOpen ? '−' : '+'}</span>
        </button>
        {manualOpen ? (
          <form onSubmit={submitLead} className="grid gap-4 border-t border-navy/10 p-5 md:grid-cols-2">
            <Field label="Headline"><input className={INPUT} value={lead.headline} onChange={(event) => setLead((value) => ({ ...value, headline: event.target.value }))} minLength={5} maxLength={320} required /></Field>
            <Field label="Source URL" hint="HTTPS only"><input className={INPUT} type="url" inputMode="url" placeholder="https://" value={lead.canonicalUrl} onChange={(event) => setLead((value) => ({ ...value, canonicalUrl: event.target.value }))} pattern="https://.*" /></Field>
            <Field label="Summary"><textarea className={`${INPUT} min-h-24 resize-y`} value={lead.summary} onChange={(event) => setLead((value) => ({ ...value, summary: event.target.value }))} maxLength={6000} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sport"><input className={INPUT} value={lead.sport} onChange={(event) => setLead((value) => ({ ...value, sport: event.target.value }))} maxLength={40} required /></Field>
              <Field label="Urgency"><select className={INPUT} value={lead.urgency} onChange={(event) => setLead((value) => ({ ...value, urgency: event.target.value }))}><option value="routine">Routine</option><option value="watch">Watch</option><option value="breaking">Breaking</option></select></Field>
            </div>
            <Field label="Source timestamp" hint="Optional"><input className={INPUT} type="datetime-local" value={lead.sourcePublishedAt} onChange={(event) => setLead((value) => ({ ...value, sourcePublishedAt: event.target.value }))} /></Field>
            <div className="flex items-end justify-end"><button className={`${BUTTON} w-full bg-navy text-white sm:w-auto`} disabled={leadBusy} type="submit">{leadBusy ? 'Adding…' : 'Add to Incoming'}</button></div>
          </form>
        ) : null}
      </section>

      <div className="grid grid-cols-3 gap-2 md:hidden" role="tablist" aria-label="Desk lanes">
        {(['incoming', 'verify', 'ready'] as const).map((lane) => (
          <button key={lane} type="button" role="tab" aria-selected={mobileLane === lane} onClick={() => setMobileLane(lane)} className={`${BUTTON} px-2 ${mobileLane === lane ? 'border-navy bg-navy text-white' : 'bg-white text-navy'}`}>
            {lane === 'incoming' ? 'Incoming' : lane === 'verify' ? 'Verify' : 'Ready'} ({lanes[lane].length})
          </button>
        ))}
      </div>
      <div className="md:hidden"><DeskColumn title={mobileLane === 'incoming' ? 'Incoming' : mobileLane === 'verify' ? 'Verify' : 'Ready'} subtitle={mobileLane === 'incoming' ? 'New leads' : mobileLane === 'verify' ? 'Evidence in progress' : 'Human-verified'} events={mobileEvents} onSelect={setSelectedId} /></div>
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        <DeskColumn title="Incoming" subtitle="New leads awaiting triage" events={lanes.incoming} onSelect={setSelectedId} />
        <DeskColumn title="Verify" subtitle="Evidence in progress" events={lanes.verify} onSelect={setSelectedId} />
        <DeskColumn title="Ready" subtitle="Human-verified events" events={lanes.ready} onSelect={setSelectedId} />
      </div>

      {selectedId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="event-detail-title" tabIndex={-1} className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-bone shadow-2xl outline-none sm:rounded-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-navy/10 bg-bone/95 px-5 py-4 backdrop-blur sm:px-7">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-broadcast-red">Event review</p>
                <h2 id="event-detail-title" className="mt-1 truncate font-serif text-xl font-bold text-navy-deep sm:text-2xl">{detail?.event.headline ?? 'Loading event…'}</h2>
              </div>
              <button type="button" className={`${BUTTON} shrink-0 bg-white`} onClick={() => setSelectedId(null)} aria-label="Close event review"><X size={18} aria-hidden="true" /></button>
            </header>
            <div className="p-5 sm:p-7">
              {detailLoading ? <div className="py-16 text-center text-sm font-semibold text-navy/55"><RefreshCw className="mx-auto mb-3 animate-spin" aria-hidden="true" />Loading evidence…</div> : null}
              {detailError ? <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{detailError}</p> : null}
              {detail ? (
                <div className="space-y-6">
                  <section className="rounded-xl border border-navy/10 bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.event.urgency === 'breaking' ? <span className="rounded-full bg-broadcast-red px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">Breaking</span> : null}
                      <span className="rounded-full bg-navy/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-navy">{STATE_LABELS[detail.event.state]}</span>
                      <span className="text-xs text-navy/55">{detail.event.sport} · version {detail.event.version}</span>
                    </div>
                    {detail.event.summary ? <p className="mt-4 max-w-3xl text-sm leading-6 text-charcoal/75">{detail.event.summary}</p> : null}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {detail.event.state === 'new' ? <button type="button" className={`${BUTTON} bg-navy text-white`} disabled={mutationBusy} onClick={() => void mutate(`/api/admin/news-desk/events/${detail.event.id}`, 'PATCH', { expectedVersion: detail.event.version, targetState: 'investigating' }, 'Verification started.')}>Start verification</button> : null}
                      {detail.event.state === 'investigating' ? <button type="button" className={`${BUTTON} bg-navy text-white`} disabled={mutationBusy} onClick={() => void mutate(`/api/admin/news-desk/events/${detail.event.id}`, 'PATCH', { expectedVersion: detail.event.version, targetState: 'verification_ready' }, 'Event moved to the final verification check.')}>Mark verification-ready</button> : null}
                      {detail.event.state === 'verified' ? (
                        <button
                          type="button"
                          className={`${BUTTON} bg-broadcast-red text-white`}
                          disabled={mutationBusy}
                          onClick={() => void createArticleDraft()}
                        >
                          <FileText size={16} aria-hidden="true" />
                          {mutationBusy ? 'Opening draft…' : 'Create article draft'}
                        </button>
                      ) : null}
                    </div>
                    {detail.event.state === 'verified' ? (
                      <p className="mt-3 text-xs leading-5 text-navy/60">
                        Creates a cited working draft only. It cannot go live until Brad reviews
                        the exact immutable revision and completes the separate approval gate.
                      </p>
                    ) : null}
                  </section>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-xl border border-navy/10 bg-white p-5">
                      <h3 className="flex items-center gap-2 font-display text-lg uppercase text-navy-deep"><ShieldCheck size={18} aria-hidden="true" /> Evidence ({detail.evidence.length})</h3>
                      <div className="mt-4 space-y-3">
                        {detail.evidence.length ? detail.evidence.map((item) => (
                          <div key={item.id} className={`rounded-lg border p-3 ${item.stance === 'contradicting' ? 'border-red-200 bg-red-50' : 'border-navy/10 bg-bone-50'}`}>
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-navy/60">{item.stance} · {item.evidenceClass} · {item.sourceTier}{supersededEvidenceIds.has(item.id) ? ' · superseded' : ''}</p>
                            <p className="mt-1 text-sm font-semibold text-navy">{item.label}</p>
                            <p className="mt-1 text-xs text-navy/55">Owner: {item.ownerKey} · {item.credible ? 'Credible' : 'Unverified'}</p>
                            {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-navy underline underline-offset-2">Open source <ExternalLink size={13} aria-hidden="true" /></a> : null}
                          </div>
                        )) : <p className="rounded-lg border border-dashed border-navy/20 px-4 py-8 text-center text-sm text-navy/55">No evidence recorded yet.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border border-navy/10 bg-white p-5">
                      <h3 className="font-display text-lg uppercase text-navy-deep">Signals ({detail.signals.length})</h3>
                      <div className="mt-4 space-y-3">
                        {detail.signals.map((signal) => (
                          <div key={signal.id} className="rounded-lg border border-navy/10 bg-bone-50 p-3">
                            <p className="text-sm font-semibold text-navy">{signal.headline}</p>
                            <p className="mt-1 text-xs text-navy/50">Observed {formatTime(signal.observedAt)}</p>
                            {signal.canonicalUrl ? <a href={signal.canonicalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-navy underline underline-offset-2">Open signal <ExternalLink size={13} aria-hidden="true" /></a> : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <details className="rounded-xl border border-navy/10 bg-white" open={detail.evidence.length === 0}>
                    <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-navy">Record evidence</summary>
                    <form onSubmit={submitEvidence} className="grid gap-4 border-t border-navy/10 p-5 md:grid-cols-2">
                      <Field label="Registered source" hint="Approved sources only"><select className={INPUT} value={evidence.sourceId} onChange={(event) => { const source = snapshot.sources.find((item) => item.id === event.target.value); setEvidence((value) => source ? { ...value, sourceId: source.id, ownerKey: source.ownerKey, sourceTier: source.tier, credible: source.tier !== 'unverified', evidenceClass: source.tier === 'primary' || source.tier === 'official' ? source.tier : 'reporting' } : { ...value, sourceId: '' }); }}><option value="">Custom attribution</option>{snapshot.sources.map((source) => <option key={source.id} value={source.id}>{source.displayName} · {source.tier}</option>)}</select></Field>
                      <Field label="Linked signal" hint="Optional"><select className={INPUT} value={evidence.signalId} onChange={(event) => setEvidence((value) => ({ ...value, signalId: event.target.value }))}><option value="">No linked signal</option>{detail.signals.map((signal) => <option key={signal.id} value={signal.id}>{signal.headline.slice(0, 90)}</option>)}</select></Field>
                      <Field label="Corrects prior evidence" hint="Optional"><select className={INPUT} value={evidence.supersedesEvidenceId} onChange={(event) => setEvidence((value) => ({ ...value, supersedesEvidenceId: event.target.value }))}><option value="">No correction link</option>{detail.evidence.filter((item) => !supersededEvidenceIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.label.slice(0, 90)}</option>)}</select></Field>
                      <Field label="Stance"><select className={INPUT} value={evidence.stance} onChange={(event) => setEvidence((value) => ({ ...value, stance: event.target.value }))}><option value="supporting">Supporting</option><option value="contradicting">Contradicting</option><option value="context">Context only</option></select></Field>
                      <Field label="Evidence class"><select className={INPUT} value={evidence.evidenceClass} onChange={(event) => { const evidenceClass = event.target.value; setEvidence((value) => ({ ...value, evidenceClass, ...(!value.sourceId && (evidenceClass === 'primary' || evidenceClass === 'official') ? { sourceTier: evidenceClass, credible: true } : {}) })); }}><option value="reporting">Reporting</option><option value="primary" disabled={Boolean(evidence.sourceId) && evidence.sourceTier !== 'primary'}>Primary record</option><option value="official" disabled={Boolean(evidence.sourceId) && evidence.sourceTier !== 'official'}>Official statement</option><option value="context">Context</option></select></Field>
                      <Field label="Source owner key" hint="Organization or reporter"><input className={INPUT} value={evidence.ownerKey} onChange={(event) => setEvidence((value) => ({ ...value, ownerKey: event.target.value }))} minLength={2} maxLength={160} disabled={Boolean(evidence.sourceId)} required /></Field>
                      <Field label="Source tier"><select className={INPUT} value={evidence.sourceTier} disabled={Boolean(evidence.sourceId)} onChange={(event) => setEvidence((value) => ({ ...value, sourceTier: event.target.value, ...(event.target.value === 'unverified' ? { credible: false } : {}) }))}><option value="primary">Primary</option><option value="official">Official</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option><option value="unverified">Unverified</option></select></Field>
                      <Field label="Evidence label"><input className={INPUT} value={evidence.label} onChange={(event) => setEvidence((value) => ({ ...value, label: event.target.value }))} minLength={3} maxLength={500} required /></Field>
                      <Field label="Source URL" hint="HTTPS only"><input className={INPUT} type="url" inputMode="url" placeholder="https://" pattern="https://.*" value={evidence.url} onChange={(event) => setEvidence((value) => ({ ...value, url: event.target.value }))} /></Field>
                      <Field label="Excerpt"><textarea className={`${INPUT} min-h-24 resize-y`} value={evidence.excerpt} onChange={(event) => setEvidence((value) => ({ ...value, excerpt: event.target.value }))} maxLength={8000} /></Field>
                      <Field label="Review notes"><textarea className={`${INPUT} min-h-24 resize-y`} value={evidence.notes} onChange={(event) => setEvidence((value) => ({ ...value, notes: event.target.value }))} maxLength={4000} /></Field>
                      <label className="flex min-h-11 items-center gap-3 rounded-lg border border-navy/10 px-3 text-sm font-semibold text-navy"><input type="checkbox" checked={evidence.credible} disabled={Boolean(evidence.sourceId) || evidence.sourceTier === 'unverified'} onChange={(event) => setEvidence((value) => ({ ...value, credible: event.target.checked }))} /> Count as credible</label>
                      <div className="flex items-end justify-end"><button type="submit" className={`${BUTTON} w-full bg-navy text-white sm:w-auto`} disabled={mutationBusy}>{mutationBusy ? 'Saving…' : 'Record evidence'}</button></div>
                    </form>
                  </details>

                  {detail.event.state === 'verification_ready' ? (
                    <form onSubmit={(event) => { event.preventDefault(); void mutate(`/api/admin/news-desk/events/${detail.event.id}/verify`, 'POST', { expectedVersion: detail.event.version, rationale: verifyRationale }, 'Event passed the verification gate.'); }} className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                      <h3 className="font-display text-lg uppercase text-emerald-900">Final verification</h3>
                      <p className="mt-1 text-xs leading-5 text-emerald-900/70">Any contradiction blocks verification. Otherwise, use one explicitly credible primary or official source, or two independent credible owners.</p>
                      <Field label="Reviewer rationale" hint="At least 20 characters"><textarea className={`${INPUT} mt-4 min-h-24 resize-y`} value={verifyRationale} onChange={(event) => setVerifyRationale(event.target.value)} minLength={20} maxLength={4000} required /></Field>
                      <button type="submit" className={`${BUTTON} mt-4 bg-emerald-800 text-white`} disabled={mutationBusy}><ShieldCheck size={16} aria-hidden="true" /> Verify event</button>
                    </form>
                  ) : null}

                  {detail.event.state !== 'dismissed' ? (
                    <details className="rounded-xl border border-red-200 bg-red-50">
                      <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-red-800">Dismiss lead</summary>
                      <form onSubmit={(event) => { event.preventDefault(); void mutate(`/api/admin/news-desk/events/${detail.event.id}/dismiss`, 'POST', { expectedVersion: detail.event.version, rationale: dismissRationale }, 'Lead dismissed with an audit note.'); }} className="border-t border-red-200 p-5">
                        <Field label="Dismissal rationale" hint="At least 10 characters"><textarea className={`${INPUT} min-h-24 resize-y`} value={dismissRationale} onChange={(event) => setDismissRationale(event.target.value)} minLength={10} maxLength={4000} required /></Field>
                        <button type="submit" className={`${BUTTON} mt-4 border-red-300 bg-white text-red-800`} disabled={mutationBusy}>Dismiss lead</button>
                      </form>
                    </details>
                  ) : null}

                  <details className="rounded-xl border border-navy/10 bg-white">
                    <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-navy">Decision history ({detail.reviews.length})</summary>
                    <div className="space-y-3 border-t border-navy/10 p-5">
                      {detail.reviews.length ? detail.reviews.map((review) => (
                        <article key={review.id} className="rounded-lg border border-navy/10 bg-bone-50 p-3">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-navy/60">{review.decision} · version {review.eventVersion}</p>
                          <p className="mt-1 text-sm text-navy">{review.rationale}</p>
                          <p className="mt-2 text-xs text-navy/50">{review.reviewerLabel} · {formatTime(review.createdAt)}</p>
                        </article>
                      )) : <p className="text-sm text-navy/55">No decision has been recorded.</p>}
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
