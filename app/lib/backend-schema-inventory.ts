import type {D1Database} from '../../types/cloudflare-runtime';
const MASTER='SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name LIMIT 513';
const HEADERS={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff',Vary:'Cookie'};
const TYPES=new Set(['table','index','trigger','view']);
const ACTIONS=new Set(['NO ACTION','RESTRICT','SET NULL','SET DEFAULT','CASCADE']);
type Row=Record<string,unknown>;
function fail():never{throw Error('schema_inventory_unavailable');}
function str(v:unknown,max=256,empty=false):string{if(typeof v!=='string'||v.length>max||(!empty&&!v.length)||v.includes('\0'))fail();return v;}
function int(v:unknown,min=0,max=65536):number{if(!Number.isSafeInteger(v)||(v as number)<min||(v as number)>max)fail();return v as number;}
function bit(v:unknown){return int(v,0,1)===1;}
function nullable(v:unknown){return v===null?null:str(v);}
function quote(name:string){return '"'+name.replaceAll('"','""')+'"';}
async function sha(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readBackendSchemaInventory(db:D1Database){
 let statements=0,metadataRows=0,definitionBytes=0,indexesFromPragmas=0,implicitIndexes=0;
 async function rows(sql:string,max:number){
  if(++statements>2048)fail();const result=await db.prepare(sql).all<Row>();
  if(!result.success||!Array.isArray(result.results)||result.results.length>max)fail();
  metadataRows+=result.results.length;if(metadataRows>16384)fail();
  if(result.results.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail();return result.results;
 }
 function master(list:Row[]){
  const seen=new Set<string>();return list.map(r=>{
   const type=str(r.type,16),name=str(r.name),tableName=str(r.tbl_name);
   if(!TYPES.has(type)||seen.has(name))fail();seen.add(name);
   const definition=r.sql===null?null:str(r.sql,131072);
   definitionBytes+=definition===null?0:new TextEncoder().encode(definition).length;if(definitionBytes>4194304)fail();
   return {type,name,tableName,definition};
  }).sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
 }
 const before=master(await rows(MASTER,512));
 const beforeText=JSON.stringify(before),byName=new Map(before.map(o=>[o.name,o]));
 const objects=[];
 for(const object of before){
  const base={name:object.name,type:object.type,tableName:object.tableName,
   internal:object.name.startsWith('sqlite_')||object.name.startsWith('_cf_'),
   virtual:object.type==='table'&&/^\s*CREATE\s+VIRTUAL\s+TABLE\b/i.test(object.definition||''),
   definitionPresent:object.definition!==null,definitionSha256:object.definition===null?null:await sha(object.definition)};
  // D1 reserves _cf_ objects and denies their PRAGMA metadata. Keep their names/hashes visible,
  // explicitly label the provider boundary, and never try another access path around it.
  if(object.name.startsWith('_cf_')){objects.push({...base,inspection:'provider-managed-details-not-requested'});continue;}
  if(!['table','view'].includes(object.type)){objects.push(base);continue;}
  const rawColumns=await rows(`PRAGMA table_xinfo(${quote(object.name)})`,256);if(!rawColumns.length)fail();
  const seenColumns=new Set<string>(),seenCids=new Set<number>(),seenPk=new Set<number>(),columns=[];
  for(const c of rawColumns){
   const cid=int(c.cid),name=str(c.name),type=str(c.type,256,true),pk=int(c.pk,0,256),hidden=int(c.hidden,0,3);
   if(seenColumns.has(name)||seenCids.has(cid)||(pk>0&&seenPk.has(pk)))fail();seenColumns.add(name);seenCids.add(cid);if(pk>0)seenPk.add(pk);
   const d=c.dflt_value===null?null:str(c.dflt_value,131072,true);
   columns.push({cid,name,type,nullable:!bit(c.notnull),primaryKeyOrder:pk,hidden,defaultPresent:d!==null,defaultSha256:d===null?null:await sha(d)});
  }
  columns.sort((a,b)=>a.cid-b.cid);const indexes=[];
  if(object.type==='table'){
   const rawIndexes=await rows(`PRAGMA index_list(${quote(object.name)})`,256),seenIndexes=new Set<string>();
   for(const i of rawIndexes){
    const name=str(i.name),origin=str(i.origin,2),descriptor=byName.get(name),sequence=int(i.seq),unique=bit(i.unique),partial=bit(i.partial);
    // WITHOUT ROWID primary btrees are visible to index_list but intentionally absent from sqlite_master.
    const implicitWithoutRowIdPrimaryKey=!descriptor&&origin==='pk'&&unique&&!partial&&name.startsWith(`sqlite_autoindex_${object.name}_`)&&/\bWITHOUT\s+ROWID\b/i.test(object.definition||'');
    if(seenIndexes.has(name)||!['c','u','pk'].includes(origin)||(!implicitWithoutRowIdPrimaryKey&&(descriptor?.type!=='index'||descriptor.tableName!==object.name)))fail();
    seenIndexes.add(name);indexesFromPragmas++;if(implicitWithoutRowIdPrimaryKey)implicitIndexes++;
    const rawKeys=await rows(`PRAGMA index_xinfo(${quote(name)})`,256),seenSeq=new Set<number>();if(!rawKeys.length)fail();
    const keys=rawKeys.map(k=>{
     const sequence=int(k.seqno),columnId=int(k.cid,-2),name=nullable(k.name),collation=nullable(k.coll);
     if(seenSeq.has(sequence))fail();seenSeq.add(sequence);if(columnId>=0&&!seenColumns.has(name||''))fail();if(columnId<0&&name!==null)fail();
     return {sequence,columnId,name,descending:bit(k.desc),collation,key:bit(k.key),expression:columnId===-2,rowId:columnId===-1};
    }).sort((a,b)=>a.sequence-b.sequence);
    indexes.push({sequence,name,origin,unique,partial,keys,definitionInSqliteMaster:!!descriptor,implicitWithoutRowIdPrimaryKey});
   }
  }
  const rawFks=object.type==='table'?await rows(`PRAGMA foreign_key_list(${quote(object.name)})`,512):[],seenFks=new Set<string>();
  const foreignKeys=rawFks.map(f=>{
   const id=int(f.id),sequence=int(f.seq),table=str(f.table),from=str(f.from),to=nullable(f.to),onUpdate=str(f.on_update,16),onDelete=str(f.on_delete,16),match=str(f.match,16),identity=`${id}:${sequence}`;
   if(seenFks.has(identity)||!seenColumns.has(from)||!ACTIONS.has(onUpdate)||!ACTIONS.has(onDelete))fail();seenFks.add(identity);
   return {id,sequence,table,from,to,onUpdate,onDelete,match};
  });
  objects.push({...base,columns,indexes:indexes.sort((a,b)=>a.name.localeCompare(b.name)),foreignKeys});
 }
 const after=master(await rows(MASTER,512));if(beforeText!==JSON.stringify(after))fail();
 const output={schemaVersion:1,schemaFingerprint:await sha(beforeText),objects,
  totals:{objects:objects.length,tables:objects.filter(o=>o.type==='table').length,views:objects.filter(o=>o.type==='view').length,indexes:objects.filter(o=>o.type==='index').length,indexesFromPragmas,implicitIndexes,triggers:objects.filter(o=>o.type==='trigger').length,virtualTables:objects.filter(o=>o.virtual).length,internalObjects:objects.filter(o=>o.internal).length},
  observation:{statements,metadataRows,allSqliteMasterObjectsIncluded:true,providerInternalDetailsInspected:false,boundariesMatched:true,atomic:false,rowBodiesIncluded:false,rawDefinitionsIncluded:false,rawDefaultsIncluded:false,checkAndExpressionSemantics:'definition-hashes-only',physicalStorageIdentityVerified:false},
  fullExport:false,sourceSnapshotVerified:false,migrationVerified:false,fullLaunchReady:false};
 if(new TextEncoder().encode(JSON.stringify(output)).length>2097152)fail();return output;
}
type Dependencies={authorized:(r:Request)=>Promise<boolean>;database:()=>Promise<D1Database>};
export async function backendSchemaInventoryResponse(request:Request,deps:Dependencies){
 const reply=(status:number,body:unknown,extra={})=>Response.json(body,{status,headers:{...HEADERS,...extra}});
 try{if(await deps.authorized(request)!==true)return reply(403,{error:'forbidden'});}catch{return reply(403,{error:'forbidden'});}
 const u=new URL(request.url),origin=request.headers.get('origin');
 if(u.pathname!=='/api/admin/source-schema-inventory')return reply(404,{error:'not_found'});if(origin&&origin!==u.origin)return reply(403,{error:'forbidden'});
 if(u.search)return reply(400,{error:'invalid_request'});if(request.method!=='GET')return reply(405,{error:'method_not_allowed'},{Allow:'GET'});
 try{return reply(200,await readBackendSchemaInventory(await deps.database()));}catch{return reply(503,{error:'schema_inventory_unavailable'});}
}
