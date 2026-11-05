import {readFileSync} from 'node:fs';
export function readWorldDataSource(){return ['../../app/data/world-data.ts','../../app/lib/spa-discovery-card.ts'].map(path=>readFileSync(new URL(path,import.meta.url),'utf8')).join('\n');}
