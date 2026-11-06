import fs from 'node:fs';import path from 'node:path';
import { composeWorldStyles } from '../../build/world-style-slots.mjs';
export function readEffectiveWorldCss() { return composeWorldStyles(fs.readFileSync(path.resolve(import.meta.dirname,'../../app/globals.css'),'utf8')); }
