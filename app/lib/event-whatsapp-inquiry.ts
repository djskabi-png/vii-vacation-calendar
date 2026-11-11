type EventInquiry = {
  submissionId: string; placeId: string; placeName: string; whatsapp?: string;
  date: string; guests: string; slot: string; eventType: string;
  name: string; phone: string; sourcePage: string; placePath?: string; privacyAccepted: boolean; honey?: string;
  language?: 'he'|'en'|'ru'|'fr';
};
type Handoff = { open: (url: string, target: string) => { opener: unknown } | null; assign: (url: string) => void; fetch: typeof fetch };

export function eventWhatsAppDestination(whatsapp?: string) {
  let destination = (whatsapp || '').replace(/\D/g, '');
  if (destination.startsWith('00')) destination = destination.slice(2);
  if (destination.startsWith('0')) destination = '972' + destination.slice(1);
  if (destination.startsWith('9720')) destination = '972' + destination.slice(4);
  return /^[1-9]\d{7,14}$/.test(destination) ? destination : null;
}

export function eventInquiryWhatsAppUrl(input: EventInquiry) {
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(input.date + 'T12:00:00Z') : null;
  if (!input.privacyAccepted || input.honey || !input.name.trim() || !input.phone.trim() || !calendarDate || Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0,10) !== input.date || !/^\d+$/.test(input.guests) || Number(input.guests) < 1) return null;
  const destination = eventWhatsAppDestination(input.whatsapp);
  if (!destination) return null;
  let url:URL;
  try { url=new URL(input.sourcePage); } catch { return null; }
  if(!['http:','https:'].includes(url.protocol))return null;
  const placeUrl = new URL(input.placePath || (input.placeId.startsWith('vacation-') ? '/business?id=' + encodeURIComponent(input.placeId) + '&mode=events' : '/events/place/' + encodeURIComponent(input.placeId)), url.origin);
  if (placeUrl.origin !== url.origin) return null;
  const formattedDate = `${input.date.slice(8, 10)}.${input.date.slice(5, 7)}.${input.date.slice(0, 4)}`;
  const copy={
    he:{intro:`שלום ${input.placeName}, אשמח לבדוק אפשרות לאירוע.`,name:'שם:',phone:'טלפון:',date:'תאריך:',guests:'מספר משתתפים:',slot:'מועד:',type:'סוג האירוע:'},
    en:{intro:`Hello ${input.placeName}, I would like to enquire about an event.`,name:'Name:',phone:'Phone:',date:'Date:',guests:'Guests:',slot:'Time:',type:'Event type:'},
    ru:{intro:`Здравствуйте, ${input.placeName}. Хочу уточнить возможность проведения мероприятия.`,name:'Имя:',phone:'Телефон:',date:'Дата:',guests:'Количество гостей:',slot:'Время:',type:'Тип мероприятия:'},
    fr:{intro:`Bonjour ${input.placeName}, je souhaite me renseigner pour un événement.`,name:'Nom :',phone:'Téléphone :',date:'Date :',guests:'Participants :',slot:'Horaire :',type:'Type d’événement :'}
  }[input.language||'he'];
  const message = [
    copy.intro,
    `${copy.name} ${input.name.trim()}`, `${copy.phone} ${input.phone.trim()}`,
    `${copy.date} ${formattedDate}`, `${copy.guests} ${input.guests}`,
    input.slot ? `${copy.slot} ${input.slot}` : '', input.eventType ? `${copy.type} ${input.eventType}` : '',
    placeUrl.href,
  ].filter(Boolean).join('\n');
  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}

/** Open during the visitor gesture. CRM persistence never gates WhatsApp. */
export function startEventWhatsAppInquiry(input: EventInquiry, handoff: Handoff) {
  const url = eventInquiryWhatsAppUrl(input);
  if (!url) return false;
  const opened = handoff.open(url, '_blank');
  if (opened) { try { opened.opener = null; } catch { /* The chat already opened. Never repeat the handoff. */ } }
  else handoff.assign(url);
  try { void handoff.fetch('/api/leads/', {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId: input.submissionId, purpose: 'whatsapp_enquiry', world: 'events', placeId: input.placeId, placeName: input.placeName,
      name: input.name.trim(), phone: input.phone.trim(), requestedDate: input.date, guests: input.guests,
      serviceName: [input.eventType, input.slot].filter(Boolean).join(' · '), sourcePage: input.sourcePage, sourceChannel: 'event_inquiry_whatsapp',
      message: new URL(url).searchParams.get('text'), privacyAccepted: true, honey: input.honey || '' }),
  }).catch(() => undefined); } catch { /* Optional CRM cannot turn an opened chat into a failed submission. */ }
  return true;
}
