import { readJsonBody } from '../../../shared/request-body.ts';

type Holiday = { id?: unknown; from?: unknown; till?: unknown; exactStay?: unknown };
type Options = { origin: string; build: string; fetcher?: typeof fetch; now?: () => number };
const periods = ['tomorrow', 'weekend', 'friday-weekend', 'thursday', 'friday'] as const;

// The managed application exports a cron handler, but its installed triggers
// are not exposed by Sites. Use the already installed edge cron as a second
// reader of the SAME lease-protected snapshots. Never create another cache or
// retry a supplier operation: a refreshing response waits for the next tick.
export async function warmHolidaySnapshots({ origin, build, fetcher = fetch, now = Date.now }: Options) {
  if (origin !== 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site' || !build || build.startsWith('pending-')) throw new Error('holiday_warm_identity');
  const deadline = now() + 55_000;
  const report = { attempted: 0, verified: 0, preparing: 0, failed: 0 };
  async function read(path: string) {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error('holiday_warm_deadline');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(8_000, remaining));
    try {
      // Workers rejects redirect:"error" during Request construction. Manual
      // mode plus strict200 admission also prevents following any redirect.
      const response = await fetcher(new Request(origin + path, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal }));
      if (response.status !== 200 || response.headers.get('X-VII-App-Build') !== build || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('holiday_warm_response');
      return await readJsonBody<Record<string, unknown>>(new Request('https://warm.invalid', { method: 'POST', body: response.body, duplex: 'half' } as RequestInit), { maxBytes: 1024 * 1024, deadlineMs: Math.max(1, Math.min(4_000, deadline - now())), signal: controller.signal });
    } finally { clearTimeout(timer); }
  }
  const calendar = await read('/api/vii/home-holidays?locale=he');
  if (!Array.isArray(calendar.holidays) || calendar.holidays.length > 6) throw new Error('holiday_warm_calendar');
  const unique = new Set<number>();
  const holidayTargets = (calendar.holidays as Holiday[]).map(holiday => {
    if (!Number.isSafeInteger(holiday.id) || Number(holiday.id) <= 0 || unique.has(Number(holiday.id))) throw new Error('holiday_warm_id');
    unique.add(Number(holiday.id));
    const params = new URLSearchParams({ id: String(holiday.id), guests: '2', part: 'all' });
    if (holiday.exactStay === true) {
      if (typeof holiday.from !== 'string' || typeof holiday.till !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(holiday.from) || !/^\d{4}-\d{2}-\d{2}$/.test(holiday.till) || holiday.from >= holiday.till) throw new Error('holiday_warm_stay');
      params.set('from', holiday.from); params.set('till', holiday.till);
    }
    return { kind: 'holiday' as const, id: Number(holiday.id), path: '/api/vii/home-holiday-deals?' + params };
  });
  const periodTargets = periods.map(period => ({
    kind: 'period' as const,
    period,
    path: '/api/vii/home-deals?' + new URLSearchParams({ period, locale: 'he', proof: 'verified-offers-v1' }),
  }));
  // Put the default near-date rail first, then interleave the remaining
  // period and holiday choices. This keeps the first screen warm without a
  // burst and prevents one family from permanently starving the other.
  const targets: Array<(typeof periodTargets)[number] | (typeof holidayTargets)[number]> = [];
  const longest = Math.max(periodTargets.length, holidayTargets.length);
  for (let i = 0; i < longest; i++) {
    if (periodTargets[i]) targets.push(periodTargets[i]);
    if (holidayTargets[i]) targets.push(holidayTargets[i]);
  }
  let index = 0;
  async function worker() {
    while (index < targets.length && now() < deadline) {
      const target = targets[index++]; report.attempted++;
      try {
        const body = await read(target.path);
        if (target.kind === 'holiday' && (body.holiday as Holiday | undefined)?.id !== target.id) throw new Error('holiday_warm_wrong_selection');
        if (target.kind === 'period' && body.period !== target.period) throw new Error('holiday_warm_wrong_period');
        if (body.availabilityStatus === 'refreshing') { report.preparing++; continue; }
        const checkedAt = Date.parse((body.cache as { checkedAt?: string } | undefined)?.checkedAt || '');
        if (body.availabilityStatus !== 'verified' || !Array.isArray(body.deals) || !Number.isFinite(checkedAt) || checkedAt > now() || now() - checkedAt >= 60 * 60_000) throw new Error('holiday_warm_unverified');
        report.verified++;
      } catch { report.failed++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker));
  return report;
}
