// Match the existing public readers, not the latest editable admin draft.
const editorialFields = ['title','summary','body','metaTitle','metaDescription','slug','imageAlt','indexable','links','attributes'];
const publicationFields = ['id','world','locale','location','filters','title','metaTitle','metaDescription','h1','summary','body','faq','slug','canonicalPath','robotsIndex','version'];
// D1 limits SQL functions to32arguments. Keep nulls and JSON subtypes while
// extending larger objects; json_patch would incorrectly remove null fields.
const jsonObject = (fields: [string,string][]) => {
 let expression=`json_object(${fields.slice(0,16).map(([key,value])=>`'${key}',${value}`).join(',')})`;
 for(let n=16;n<fields.length;n+=15) expression=`json_set(${expression},${fields.slice(n,n+15).map(([key,value])=>`'$.${key}',${value}`).join(',')})`;
 return expression;
};
const projectJson = (column: string, fields: string[]) => jsonObject(fields.map(key=>[key,`json_extract(${column},'$.${key}')`]));
const opportunityJson=jsonObject([
 ['id','o.id'],['world','o.world'],['locale','o.locale'],['location','o.location'],['filters','json(o.filters_json)'],
 ['canonicalPath','o.canonical_path'],['slug','o.slug'],['suggestedTitle','o.suggested_title'],
 ['title','o.title'],['metaTitle','o.meta_title'],['metaDescription','o.meta_description'],['h1','o.h1'],
 ['summary','o.summary'],['body','o.body'],['faq','json(o.faq_json)'],['version','o.version']
]);
export const PUBLIC_CMS_PROJECTION_SQL = `
WITH
editorial AS (
 SELECT 'editorial' AS family,i.id AS identity,json_object(
  'contentType',i.content_type,'entityKey',i.entity_key,'world',i.world,'locale',i.locale,
  'version',v.version,'content',json(${projectJson('v.content_json',editorialFields)})) AS data
 FROM vii_content_items i JOIN vii_content_versions v ON v.item_id=i.id AND v.version=CASE
  WHEN i.status='scheduled' AND i.scheduled_at<=?1 THEN i.version ELSE i.published_version END
 WHERE i.status<>'archived'
),
search_versions AS (
 SELECT 'search-version' AS family,v.path AS identity,
  json_object('path',v.path,'title',v.title,'description',v.description,'version',v.version) AS data
 FROM vii_search_page_versions v
 WHERE (v.status='published' OR (v.status='scheduled' AND v.scheduled_at<=?1))
 AND NOT EXISTS (SELECT 1 FROM vii_search_page_versions newer WHERE newer.path=v.path
  AND (newer.status='published' OR (newer.status='scheduled' AND newer.scheduled_at<=?1)) AND newer.version>v.version)
),
opportunities AS (
 SELECT 'search-opportunity' AS family,o.id AS identity,${opportunityJson} AS data
 FROM vii_search_page_opportunities o WHERE o.robots_index=1
  AND (o.status='published' OR (o.status='scheduled' AND o.scheduled_at<=?1))
),
publications AS (
 SELECT 'search-publication' AS family,p.canonical_path AS identity,json_object(
  'canonicalPath',p.canonical_path,'world',p.world,'locale',p.locale,
  'content',json(${projectJson('p.snapshot_json',publicationFields)})) AS data
 FROM vii_search_page_publications p WHERE p.scheduled_at IS NULL OR p.scheduled_at<=?1
),
geography AS (
 SELECT 'geography' AS family,node_key AS identity,json_object(
  'key',node_key,'level',level,'supplierId',supplier_id,'parentKey',parent_key,
  'title',COALESCE(NULLIF(title_override,''),supplier_title),
  'titleEn',COALESCE(NULLIF(title_en_override,''),supplier_title_en),'titleOverride',title_override,
  'titleEnOverride',title_en_override,'slug',slug,'visible',visible,'featured',featured,
  'gpsLat',gps_lat,'gpsLong',gps_long,'unassigned',unassigned,'version',version) AS data
 FROM vii_geography_nodes WHERE visible=1
),
redirects AS (
 SELECT 'redirect' AS family,source_path AS identity,
  json_object('sourcePath',source_path,'targetPath',target_path,'status',status) AS data
 FROM vii_redirects WHERE active=1
),
family_a AS MATERIALIZED (
 SELECT * FROM editorial UNION ALL SELECT * FROM search_versions UNION ALL SELECT * FROM opportunities
),
family_b AS MATERIALIZED (
 SELECT * FROM publications UNION ALL SELECT * FROM geography UNION ALL SELECT * FROM redirects
)
SELECT * FROM family_a UNION ALL SELECT * FROM family_b
ORDER BY family,identity`;

export const CMS_FAMILIES = ['editorial','search-version','search-opportunity','search-publication','geography','redirect'] as const;
export const CMS_MAX_ROWS = 20000, CMS_MAX_BYTES = 12*1024*1024, CMS_MAX_ROW_BYTES = 1_900_000;
export const PUBLIC_CMS_SNAPSHOT_SQL = `WITH public_rows AS MATERIALIZED (${PUBLIC_CMS_PROJECTION_SQL}),
 measure AS (SELECT COUNT(*) AS row_count,COALESCE(SUM(length(CAST(data AS BLOB))+length(CAST(identity AS BLOB))+128),0) AS bytes,
  COALESCE(MAX(length(CAST(data AS BLOB))+128),0) AS row_bytes FROM public_rows),
 guard AS (SELECT *,CASE WHEN row_count<=${CMS_MAX_ROWS} AND bytes<=${CMS_MAX_BYTES}
  AND row_bytes<=${CMS_MAX_ROW_BYTES} THEN 1 ELSE 0 END AS ok FROM measure)
SELECT 'control' AS family,'' AS identity,json_object('ok',ok,'rowCount',row_count,'rawBytes',bytes) AS data FROM guard
UNION ALL SELECT family,identity,data FROM public_rows WHERE (SELECT ok FROM guard)=1 ORDER BY family,identity`;
const families = new Set<string>(CMS_FAMILIES);
const encoder = new TextEncoder();
export type PublicCmsRow = {family: string; identity: string; data: string};
export function publicCmsIdentity(family: string, data: Record<string, unknown>) {
 return family==='editorial'?`${data.contentType}:${data.entityKey}:${data.locale}`
  :family==='search-version'?data.path:family==='search-opportunity'?data.id
  :family==='search-publication'?data.canonicalPath:family==='geography'?data.key:data.sourcePath;
}
export function validatePublicCmsProjection(rows: PublicCmsRow[], observedAt: string) {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(observedAt) || new Date(observedAt).toISOString()!==observedAt) throw Error('invalid_observation_time');
 if (!Array.isArray(rows) || rows.length>CMS_MAX_ROWS) throw Error('projection_limit');
 const seen=new Set<string>(),counts: Record<string,number>=Object.fromEntries([...families].map(f=>[f,0]));
 let totalBytes=0;
 const records=rows.map(row=>{
  if (!families.has(row.family) || typeof row.identity!=='string' || !row.identity || row.identity.length>500 || typeof row.data!=='string') throw Error('invalid_projection');
  const key=JSON.stringify([row.family,row.identity]);
  if (seen.has(key)) throw Error('duplicate_projection');
  seen.add(key); counts[row.family]++;
  const bytes=encoder.encode(row.data).byteLength;
  totalBytes+=bytes;
  if(totalBytes>CMS_MAX_BYTES || bytes>CMS_MAX_ROW_BYTES) throw Error('projection_limit');
  const data=JSON.parse(row.data);
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('invalid_projection');
  if(publicCmsIdentity(row.family,data)!==row.identity) throw Error('projection_identity_mismatch');
  return {family:row.family,identity:row.identity,data};
 });
 return {schemaVersion:1,observedAt,counts,records,
  limitations:{liveSourceVerified:false,completeDatabaseExport:false,staticFileFallbacksIncluded:false,
   rawPublishedTextMayContainPersonalData:true,stageUploadAuthorized:false,migrationVerified:false,fullLaunchReady:false}};
}
