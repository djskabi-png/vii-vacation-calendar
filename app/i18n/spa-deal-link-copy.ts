import type { SiteLanguage } from './locale-provider';

export function spaAllPackagesLabel(date:string,today:string,tomorrow:string,language:SiteLanguage,fallback:string) {
  if(date===today)return {he:'לכל חבילות הספא להיום',en:'All spa packages for today',ru:'Все спа-пакеты на сегодня',fr:'Tous les forfaits spa pour aujourd’hui'}[language];
  if(date===tomorrow)return {he:'לכל חבילות הספא למחר',en:'All spa packages for tomorrow',ru:'Все спа-пакеты на завтра',fr:'Tous les forfaits spa pour demain'}[language];
  const value=new Date(date+'T12:00:00Z');
  if(!date||Number.isNaN(value.getTime()))return fallback;
  const day=new Intl.DateTimeFormat(language==='he'?'he-IL':language,{weekday:'long',timeZone:'UTC'}).format(value);
  if(language==='he')return `לכל חבילות הספא ל${day}`;
  if(language==='ru')return `Все спа-пакеты на ${['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'][value.getUTCDay()]}`;
  return language==='fr'?`Tous les forfaits spa pour ${day}`:`All spa packages for ${day}`;
}
