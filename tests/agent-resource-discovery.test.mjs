import test from 'node:test';
import assert from 'node:assert/strict';
import {agentDiscoveryManifest, serveAgentDiscovery} from '../worker/agent-discovery.ts';

test('public ARD entry identifies real read-only documentation on its own publisher', async()=>{
  for(const origin of ['https://vii.spaplus.co','https://www.vii.co.il']){
    const {entries}=agentDiscoveryManifest(origin);
    assert.equal(entries.length,1);
    const entry=entries[0];
    assert.equal(entry.identifier,`urn:air:${new URL(origin).hostname}:guide:place-discovery`);
    assert.equal(entry.url,`${origin}/agent-guide.md`);
    assert.equal('data' in entry,false);
    assert.ok(entry.displayName);
    assert.match(entry.type,/^text\/markdown/);
    assert.equal(entry.representativeQueries.length,2);
    const guide=serveAgentDiscovery(new Request(entry.url),origin,'test-build');
    assert.equal(guide.status,200);
    assert.match(await guide.text(),/public browsing instructions only/);
  }
});

test('ARD and guide serve GET and bodyless HEAD without writes or application initialization',async()=>{
  for(const path of ['/.well-known/ard.json','/agent-guide.md']){
    const url='https://vii.spaplus.co'+path;
    const response=serveAgentDiscovery(new Request(url),'https://vii.spaplus.co','test-build');
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-VII-App-Build'),'test-build');
    assert.match(response.headers.get('Content-Type'),path.endsWith('json')?/application\/json/:/text\/markdown/);
    const head=serveAgentDiscovery(new Request(url,{method:'HEAD'}),'https://vii.spaplus.co','test-build');
    assert.equal(await head.text(),'');
    const write=serveAgentDiscovery(new Request(url,{method:'POST'}),'https://vii.spaplus.co','test-build');
    assert.equal(write.status,405);
    assert.equal(write.headers.get('Allow'),'GET, HEAD');
  }
  assert.equal(serveAgentDiscovery(new Request('https://vii.spaplus.co/admin'),'https://vii.spaplus.co','test-build'),null);
});
