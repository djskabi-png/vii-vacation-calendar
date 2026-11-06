import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const files=['services/vii-quality-browser/build-definition.mjs','services/vii-quality-browser/src/engine.ts','services/vii-quality-browser/src/index.ts','services/vii-quality-browser/src/request-body.ts','services/vii-quality-browser/src/evidence.ts','services/vii-quality-browser/package.json','services/vii-quality-browser/pnpm-lock.yaml','services/vii-quality-control/src/browser-profiles.ts','services/vii-quality-control/src/browser-executor.ts'];
export function browserDefinition(){const digest=createHash('sha256');for(const file of files)digest.update(file).update('\0').update(readFileSync(resolve(root,file),'utf8').replace(/\r\n?/g,'\n')).update('\0');return {schemaVersion:1,sha256:digest.digest('hex'),files};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const definition=browserDefinition(),path=resolve(root,'services/vii-quality-browser/engine-definition.json');
 if(process.argv.includes('--write'))writeFileSync(path,JSON.stringify(definition,null,2)+'\n');
 else if(JSON.parse(readFileSync(path,'utf8')).sha256!==definition.sha256)throw Error('browser_definition_changed_regenerate_and_requalify');
 console.log(JSON.stringify({definition:definition.sha256}));
}
