/** Only admit the requested supplier's own facility section, never page-wide marketing text. */
export function parseSpaPlusFacilities(html, supplierId) {
  const identity = html.match(/<input[^>]*name=["']siteid["'][^>]*value=["'](\d+)["'][^>]*>/i)?.[1];
  if (Number(identity) !== supplierId) throw Error('supplier_identity_mismatch');
  const start = html.lastIndexOf('מאפייני המקום'), end = html.indexOf('תיאור המקום', start);
  if (start < 0 || end <= start || end-start > 300000) throw Error('facility_section_missing');
  const section = html.slice(start, end), labels = [], ids = [];
  const headings = [...section.matchAll(/<div[^>]*data-cid=["']([^"']+)["'][^>]*>/gi)];
  for (let i=0; i<headings.length; i++) {
    const match=headings[i], block=section.slice(match.index+match[0].length,headings[i+1]?.index??section.length);
    const label=(block.match(/<span[^>]*>([^<]+)<\/span>/i)?.[1]||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&nbsp;/g,' ').replace(/\\/g,'').replace(/\s+/g,' ').trim();
    const facilityIds=match[1].split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0);
    if(label && facilityIds.length) { labels.push(label); ids.push(...facilityIds); }
  }
  if(!headings.length || labels.length!==headings.length) throw Error('incomplete_facility_extraction');
  return {verifiedSupplierId:Number(identity),providerFacilityIds:[...new Set(ids)],labels:[...new Set(labels)]};
}
