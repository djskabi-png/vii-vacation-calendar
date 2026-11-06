import test from 'node:test'; import assert from 'node:assert/strict';
import * as api from '../src/browser-profiles.ts';
import {loadImpactGraph} from '../../../scripts/release-impact-graph.mjs';
test('registry has 26 immutable supported profiles',()=>{assert.equal(api.browserProfiles.length,26);assert.equal(new Set(api.browserProfiles.map(x=>x.profileId)).size,26);assert.equal(api.browserProfiles.filter(x=>x.gallery).length,2);assert.equal(api.browserProfiles.every(x=>x.timeoutMs===45000&&x.maxRequests===180),true);});
test('profile lookup fails closed and every profile has actual graph and plan ownership',()=>{
 assert.equal(api.browserProfile('nope'),null);const graph=loadImpactGraph();
 for(const p of api.browserProfiles){for(const box of p.boxIds)assert.ok(graph.nodes[box],box);for(const requirement of p.requirementIds)assert.match(requirement,/^(?:V|Q)\d{2}$/);assert.equal(Object.isFrozen(p.boxIds),true);assert.throws(()=>p.boxIds.push('unowned'));}
 const p=api.browserProfile('vacations-mobile-gallery-next');assert.equal(p.world,'vacations');assert.equal(p.scenario,'gallery-next');assert.ok(p.requirementIds.includes('V08'));assert.equal(api.browserProfile('spa-mobile-gallery-next'),null);
});
