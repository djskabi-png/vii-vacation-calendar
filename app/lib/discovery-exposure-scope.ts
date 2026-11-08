const searchKeys=new Set(['location','area','type','types','features','pool','accessible','spaFor','spaDealFor','spaDealDate','date','from','to','till','checkin','checkout','guests','adults','children','infants','rooms','bedrooms','eventType','slot','participants','minPrice','maxPrice','online','pets','period','holiday','part','audience']);
/** View mode, map panning and campaign tags do not reshuffle the same search. */
export function discoveryExposureScope(pathname:string,params:Pick<URLSearchParams,'entries'>){
 const query=new URLSearchParams();
 for(const [name,value]of [...params.entries()].sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)))if(searchKeys.has(name))query.append(name,value);
 return `${pathname.replace(/^\/(?:en|fr|ru)(?=\/)/,'').replace(/\/$/,'')||'/'}?${query}`;
}
