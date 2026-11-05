export type QualityJobIntent = { key: string; level: 'regular'|'medium'|'full'; scope?: { changedBoxes: string[] } };
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
const storageKey='vii-quality-pending-intent';
function validated(value: unknown): QualityJobIntent {
  if(!value || typeof value!=='object' || Array.isArray(value))throw Error('invalid_quality_intent');
  const row=value as Record<string,unknown>;
  if(typeof row.key!=='string' || !/^[A-Za-z0-9:_-]{8,120}$/.test(row.key) || !['regular','medium','full'].includes(String(row.level)))throw Error('invalid_quality_intent');
  const scope=row.scope as {changedBoxes?:unknown}|undefined;
  if(scope!==undefined && (!scope || !Array.isArray(scope.changedBoxes) || scope.changedBoxes.length!==1 || typeof scope.changedBoxes[0]!=='string' || !scope.changedBoxes[0] || scope.changedBoxes[0].length>120))throw Error('invalid_quality_intent');
  return {key:row.key,level:row.level as QualityJobIntent['level'],...(scope?{scope:{changedBoxes:[...(scope.changedBoxes as string[])]}}:{})};
}
export function readQualityJobIntent(storage:Storage):QualityJobIntent|null {
  const raw=storage.getItem(storageKey);if(raw===null)return null;
  const saved=JSON.parse(raw);if(saved.version!==1)throw Error('invalid_quality_intent_version');
  return validated(saved.intent);
}
export function persistQualityJobIntent(storage:Storage,intent:QualityJobIntent) {
  const encoded=JSON.stringify({version:1,intent:validated(intent)});
  storage.setItem(storageKey,encoded);
  if(storage.getItem(storageKey)!==encoded)throw Error('quality_intent_not_persisted');
}
export function clearQualityJobIntent(storage:Storage) { storage.removeItem(storageKey); }
