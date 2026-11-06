type BrowserRequest = { method(): string; url(): string; headers(): Record<string, string>; postData(): string | null };
const keys = new Set(['world','from','till','guests','hours','rooms','slot','candidates','includePlaces','region','discoverySearch','discoveryVersion']);
const integer = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value;
}
/** The owned live-search endpoint reads supplier availability; it does not
 * create bookings, leads or payments. Its normal discovery-cache writes remain
 * behind the API's own leases/budgets. This exception grants no other POST. */
export function isReadOnlyDiscoveryRequest(request: BrowserRequest, origin: string): boolean {
  try {
    const url = new URL(request.url());
    if (request.method() !== 'POST' || url.origin !== origin || url.username || url.password || url.pathname !== '/api/vii/live-search' || url.search || url.hash) return false;
    const contentType = Object.entries(request.headers()).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
    if(Object.keys(request.headers()).some(key=>['next-action','x-server-action'].includes(key.toLowerCase())))return false;
    if (contentType?.split(';')[0].trim().toLowerCase() !== 'application/json') return false;
    const raw = request.postData();
    if (typeof raw !== 'string' || !raw || new TextEncoder().encode(raw).length > 8192) return false;
    const body: unknown = JSON.parse(raw);
    if (!record(body) || Object.keys(body).some(key => !keys.has(key)) || !['vacations','events'].includes(String(body.world)) || !date(body.from) || !date(body.till) || !integer(body.guests,1,1000)) return false;
    const days = (Date.parse(body.till)-Date.parse(body.from))/86400000;
    if (days < 0 || days > 62) return false;
    if (body.hours !== undefined && !integer(body.hours,1,24)) return false;
    if (body.slot !== undefined && !['morning','evening'].includes(String(body.slot))) return false;
    for (const flag of ['includePlaces','discoverySearch']) if (body[flag] !== undefined && typeof body[flag] !== 'boolean') return false;
    if (body.discoveryVersion !== undefined && !integer(body.discoveryVersion,1,10000)) return false;
    if (body.region !== undefined && (typeof body.region !== 'string' || body.region.length > 120)) return false;
    if (body.rooms !== undefined && (!Array.isArray(body.rooms) || !body.rooms.length || body.rooms.length > 10 || body.rooms.some(room => !record(room) || Object.keys(room).some(key => !['adults','children','infants'].includes(key)) || !integer(room.adults,1,30) || room.children !== undefined && !integer(room.children,0,20) || room.infants !== undefined && !integer(room.infants,0,10)))) return false;
    const from = body.from, till = body.till;
    if (body.candidates !== undefined && (!Array.isArray(body.candidates) || !body.candidates.length || body.candidates.length > 32 || body.candidates.some(item => !record(item) || Object.keys(item).some(key => !['from','till'].includes(key)) || !date(item.from) || !date(item.till) || item.till <= item.from || item.from < from || item.till > till))) return false;
    return true;
  } catch { return false; }
}
