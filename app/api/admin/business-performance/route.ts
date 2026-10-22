import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { businessAnalyticsDatabase } from "../../../lib/business-analytics.ts";
import { conversionTarget, fetchViiConversions, ViiConversionsError } from "../../../lib/vii-conversions.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
export async function GET(request:Request){
  const s=await authorizedAdminSession(request).catch(()=>null);
  if(!s)return Response.json({error:"forbidden"},{status:403,headers});
  const url=new URL(request.url);
  if(url.searchParams.get("mode")==="conversions"){
    const target=conversionTarget(url.searchParams.get("placeId")||"",url.searchParams.get("world")||"");
    const from=url.searchParams.get("from")||"";const till=url.searchParams.get("till")||"";
    if(!target)return Response.json({error:"conversion_not_supported"},{status:400,headers});
    try{
      const conversions=await fetchViiConversions({...target,from,till,token:await supplierToken(),sectionOnly:true});
      return Response.json({conversions},{headers});
    }catch(error){
      if(error instanceof ViiConversionsError){
        const status=error.code==="invalid_request"?400:error.code==="not_supported"?404:503;
        console.warn("vii_conversions_failed",{code:error.code,upstreamStatus:error.status,world:target.world,siteID:target.siteID});
        return Response.json({error:error.code,upstreamStatus:error.status},{status,headers});
      }
      return Response.json({error:"supplier_unavailable"},{status:503,headers});
    }
  }
  const days=Number(url.searchParams.get("days")||30);
  if(![1,7,30].includes(days))return Response.json({error:"invalid_period"},{status:400,headers});
  try{const db=await businessAnalyticsDatabase();const since=new Date(Date.now()-days*864e5).toISOString();const rows=await db.prepare(`SELECT place_id AS placeId, place_name AS placeName, world,
    SUM(CASE WHEN name = 'impression' THEN 1 ELSE 0 END) AS impressions,
    SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
    SUM(CASE WHEN name = 'phone_reveal' THEN 1 ELSE 0 END) AS phoneReveals,
    SUM(CASE WHEN name = 'whatsapp_lead' THEN 1 ELSE 0 END) AS whatsappLeads,
    SUM(CASE WHEN name = 'booking_request' THEN 1 ELSE 0 END) AS bookingRequests,
    COUNT(DISTINCT session_id) AS uniqueBrowsers
    FROM vii_business_events WHERE created_at >= ? AND internal = 0
    GROUP BY place_id, place_name, world ORDER BY pageViews DESC, impressions DESC LIMIT 200`).bind(since).all();return Response.json({periodDays:days,since,rows:rows.results},{headers});}catch{return Response.json({error:"business_performance_unavailable"},{status:503,headers});}
}
