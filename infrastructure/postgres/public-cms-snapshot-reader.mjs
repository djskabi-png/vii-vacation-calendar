import {createHash} from 'node:crypto';
import {CMS_FAMILIES,CMS_MAX_ROWS,publicCmsIdentity} from './public-cms-projection.mjs';
export const CMS_SNAPSHOT_SEED='vii-public-cms-snapshot-v1';
const digest=(previous,line)=>createHash('sha256').update(previous+'\n'+line).digest('hex');
export function verifyPublicCmsSnapshot(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>32*1024*1024||!text.endsWith('\n'))throw Error('incomplete_cms_snapshot');
 const lines=text.slice(0,-1).split('\n');
 if(lines.length<2||lines.length>CMS_MAX_ROWS+2||lines.some(line=>!line||Buffer.byteLength(line)>2_000_000))throw Error('invalid_cms_snapshot');
 const manifest=JSON.parse(lines[0]),footer=JSON.parse(lines.at(-1));
 if(manifest.type!=='manifest'||manifest.format!==CMS_SNAPSHOT_SEED||manifest.consistency!=='one-read-only-sql-statement'||manifest.fullDatabaseExport!==false||manifest.migrationVerified!==false||manifest.stageUploadAuthorized!==false||manifest.fullLaunchReady!==false)throw Error('invalid_cms_manifest');
 if(typeof manifest.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest.observedAt)||new Date(manifest.observedAt).toISOString()!==manifest.observedAt)throw Error('invalid_cms_observation');
 if(!manifest.counts||Object.keys(manifest.counts).length!==CMS_FAMILIES.length||CMS_FAMILIES.some(key=>!Number.isSafeInteger(manifest.counts[key])||manifest.counts[key]<0))throw Error('invalid_cms_counts');
 const counts=Object.fromEntries(CMS_FAMILIES.map(key=>[key,0])),seen=new Set(),records=[];
 let chain=digest(CMS_SNAPSHOT_SEED,lines[0]+'\n');
 for(const line of lines.slice(1,-1)){
  const row=JSON.parse(line);
  if(row.type!=='record'||!CMS_FAMILIES.includes(row.family)||typeof row.identity!=='string'||!row.identity||row.identity.length>500||!row.data||typeof row.data!=='object'||Array.isArray(row.data))throw Error('invalid_cms_record');
  const key=JSON.stringify([row.family,row.identity]);if(seen.has(key))throw Error('duplicate_cms_record');seen.add(key);counts[row.family]++;
  const identity=publicCmsIdentity(row.family,row.data);
  if(identity!==row.identity)throw Error('cms_identity_mismatch');
  chain=digest(chain,line+'\n');records.push(row);
 }
 if(footer.type!=='complete'||footer.rows!==records.length||footer.sha256!==chain||CMS_FAMILIES.some(key=>counts[key]!==manifest.counts[key]))throw Error('cms_integrity_mismatch');
 return {counts,records,integritySha256:chain,integrityVerified:true,sourceConsistencyVerified:false,
  fullDatabaseExport:false,stageUploadAuthorized:false,targetReadVerified:false,migrationVerified:false,fullLaunchReady:false};
}
