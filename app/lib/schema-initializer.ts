const initializations=new WeakMap<object,Map<string,Promise<void>>>();

/** A schema version is initialized once per live binding object. Concurrent
 * readers share initialization; failure is evicted so a later request can
 * recover. This caches schema readiness only, never records or query results. */
export function initializeSchemaOnce(binding:object,version:string,initialize:()=>Promise<void>):Promise<void>{
  let versions=initializations.get(binding);
  if(!versions){versions=new Map();initializations.set(binding,versions)}
  const existing=versions.get(version);if(existing)return existing;
  const selected=versions;
  const pending=Promise.resolve().then(initialize);
  selected.set(version,pending);
  void pending.catch(()=>{if(selected.get(version)===pending)selected.delete(version)});
  return pending;
}
