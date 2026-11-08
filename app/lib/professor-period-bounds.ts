const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function midnight(day:string){
 const target=Date.parse(day+'T00:00:00Z');let timestamp=target;
 for(let step=0;step<3;step++){
  const parts=Object.fromEntries(formatter.formatToParts(new Date(timestamp)).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
  const rendered=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);
  const next=timestamp+target-rendered;if(next===timestamp)break;timestamp=next;
 }
 return new Date(timestamp).toISOString();
}
/** Inclusive Israel calendar dates become an exclusive UTC timestamp interval. */
export function professorPeriodBounds(from:string,till:string){
 const next=new Date(till+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return {since:midnight(from),until:midnight(next.toISOString().slice(0,10))};
}
