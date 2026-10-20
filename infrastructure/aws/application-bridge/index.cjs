"use strict";
const crypto = require("node:crypto");
const { Client } = require("pg");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const secrets = new SecretsManagerClient({});
let cachedSecret;

function equalToken(value) {
  const expectedHex = process.env.BRIDGE_TOKEN_SHA256 || "";
  if (!/^[a-f0-9]{64}$/.test(expectedHex)) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), crypto.createHash("sha256").update(value || "").digest());
}
async function credentials() {
  if (!cachedSecret) {
    const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
    cachedSecret = JSON.parse(result.SecretString || "{}");
  }
  return cachedSecret;
}
function placeholders(sql) {
  let output="", index=0, quote=null;
  for (let i=0;i<sql.length;i+=1) { const char=sql[i];
    if (quote) { output+=char; if (char===quote && sql[i-1]!=="\\") quote=null; continue; }
    if (char==="'" || char==='"') { quote=char; output+=char; continue; }
    if (char==="?") { index+=1; output+=`$${index}`; continue; } output+=char;
  } return output;
}
function jsonPath(path) { return `{${path.replace(/^\$\.?/,"").split(".").filter(Boolean).join(",")}}`; }
function translate(sql) {
  const ignored=/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(sql);
  let query=sql.trim().replace(/;\s*$/,"").replace(/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i,"INSERT INTO ");
  query=query.replace(/\bjson_object\s*\(/gi,"json_build_object(")
    .replace(/json_extract\s*\(\s*([\w.]+)\s*,\s*'([^']+)'\s*\)/gi,(_m,c,p)=>`(${c}::jsonb #>> '${jsonPath(p)}')`)
    .replace(/json_type\s*\(\s*([\w.]+)\s*,\s*'([^']+)'\s*\)/gi,(_m,c,p)=>`jsonb_typeof(${c}::jsonb #> '${jsonPath(p)}')`)
    .replace(/\blength\s*\(\s*CAST\((.*?)\s+AS\s+BLOB\)\s*\)/gi,"octet_length(convert_to(($1)::text,'UTF8'))")
    .replace(/\s+COLLATE\s+NOCASE\b/gi,"")
    .replace(/\bdatetime\s*\(\s*'now'\s*\)/gi,"CURRENT_TIMESTAMP")
    .replace(/\bstrftime\s*\(\s*'%s'\s*,\s*'now'\s*\)/gi,"EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)");
  if (ignored && !/\bON\s+CONFLICT\b/i.test(query)) { const returning=query.match(/\s+RETURNING\s+/i); query=returning?`${query.slice(0,returning.index)} ON CONFLICT DO NOTHING${query.slice(returning.index)}`:`${query} ON CONFLICT DO NOTHING`; }
  return placeholders(query);
}
async function pragma(client,sql) {
  const match=sql.trim().match(/^PRAGMA\s+(table_info|table_xinfo|index_list|index_xinfo|foreign_key_list)\s*\(\s*["']?([\w]+)["']?\s*\)/i); if(!match)return null;
  const [,kind,name]=match;
  if(kind.toLowerCase().startsWith("table_")) return client.query(`SELECT c.ordinal_position-1 AS cid,c.column_name AS name,c.data_type AS type,CASE WHEN c.is_nullable='NO' THEN 1 ELSE 0 END AS notnull,c.column_default AS dflt_value,CASE WHEN tc.constraint_type='PRIMARY KEY' THEN 1 ELSE 0 END AS pk,0 AS hidden FROM information_schema.columns c LEFT JOIN information_schema.key_column_usage k USING(table_schema,table_name,column_name) LEFT JOIN information_schema.table_constraints tc USING(constraint_catalog,constraint_schema,constraint_name,table_schema,table_name) WHERE c.table_schema='public' AND c.table_name=$1 ORDER BY c.ordinal_position`,[name]);
  if(kind.toLowerCase()==="index_list") return client.query(`SELECT row_number() OVER()-1 AS seq,indexname AS name,CASE WHEN indexdef ILIKE '%UNIQUE%' THEN 1 ELSE 0 END AS unique,'c' AS origin,0 AS partial FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`,[name]);
  if(kind.toLowerCase()==="index_xinfo") return client.query(`SELECT row_number() OVER()-1 AS seqno,a.attnum-1 AS cid,a.attname AS name,0 AS desc,'BINARY' AS coll,1 AS key FROM pg_class i JOIN pg_index ix ON i.oid=ix.indexrelid JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=ANY(ix.indkey) WHERE i.relname=$1 ORDER BY a.attnum`,[name]);
  return client.query(`SELECT kcu.ordinal_position-1 AS id,kcu.ordinal_position-1 AS seq,ccu.table_name AS table,kcu.column_name AS from,ccu.column_name AS to,rc.update_rule AS on_update,rc.delete_rule AS on_delete,'NONE' AS match FROM information_schema.key_column_usage kcu JOIN information_schema.referential_constraints rc USING(constraint_catalog,constraint_schema,constraint_name) JOIN information_schema.constraint_column_usage ccu USING(constraint_catalog,constraint_schema,constraint_name) WHERE kcu.table_schema='public' AND kcu.table_name=$1 ORDER BY kcu.ordinal_position`,[name]);
}
async function execute(client,operation) {
  const started=Date.now(), result=await pragma(client,operation.sql)||await client.query(translate(operation.sql),operation.params||[]), rows=result.rows||[], fields=(result.fields||[]).map(f=>f.name);
  return {success:true,results:operation.method==="run"?[]:rows,raw:operation.method==="raw"?rows.map(r=>fields.map(f=>r[f])):undefined,meta:{changes:Number(result.rowCount||0),duration:Date.now()-started}};
}
exports.handler=async event=>{
  const token=(event.headers?.authorization||event.headers?.Authorization||"").replace(/^Bearer\s+/i,"");
  if(!equalToken(token))return {statusCode:404,body:JSON.stringify({ok:false,error:"not_found"})};
  let body; try{body=JSON.parse(event.body||"{}");}catch{return {statusCode:400,body:JSON.stringify({ok:false,error:"invalid_json"})};}
  if(!Array.isArray(body.operations)||body.operations.length<1||body.operations.length>100)return {statusCode:400,body:JSON.stringify({ok:false,error:"invalid_operations"})};
  const secret=await credentials(); const client=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),database:process.env.DB_NAME||secret.dbname||"vii",user:secret.username,password:secret.password,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000,statement_timeout:20000});
  try{await client.connect();if(body.transactional)await client.query("BEGIN");const results=[];for(const operation of body.operations){if(!operation||typeof operation.sql!=="string"||operation.sql.length>100000||!Array.isArray(operation.params))throw new Error("invalid_operation");results.push(await execute(client,operation));}if(body.transactional)await client.query("COMMIT");return {statusCode:200,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify({ok:true,results})};}
  catch(error){if(body.transactional)await client.query("ROLLBACK").catch(()=>{});console.error("VII database bridge operation failed",error?.message||error);return {statusCode:500,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify({ok:false,error:"database_operation_failed"})};}
  finally{await client.end().catch(()=>{});}
};
