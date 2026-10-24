import assert from 'node:assert/strict';
import test from 'node:test';
import {rewriteCanonicalStream} from '../worker/stream-canonical.ts';
const links=href=>({canonical:`https://vii.spaplus.co${href}`,alternates:'<link rel="alternate" hreflang="en" href="https://vii.spaplus.co/en">'});
const input='<html><head><link rel="canonical" href="/"/></head><body><h1>כל החופשה, במקום אחד</h1>שלום 😎<script>self.rsc="unchanged"</script></body></html>';
const expected=input.replace(/<link rel="canonical" href="([^"]+)"\s*\/?>/,(_tag,href)=>`<link rel="canonical" href="${links(href).canonical}">${links(href).alternates}`);
test('all byte boundaries preserve Hebrew, emoji, scripts and exact canonical-only replacement',async()=>{
  const bytes=new TextEncoder().encode(input);
  for(let split=1;split<bytes.length;split++) {
    const response=rewriteCanonicalStream(new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,split));c.enqueue(bytes.slice(split));c.close();}})),links);
    assert.equal(await response.text(),expected,`split ${split}`);
  }
});
test('the hero can reach the client while the catalog tail is still unresolved',async()=>{
  let source;
  const response=rewriteCanonicalStream(new Response(new ReadableStream({start(c){source=c;c.enqueue(new TextEncoder().encode('<html><head><link rel="canonical" href="/"/></head><body><h1>כל החופשה, במקום אחד</h1>'));}}),{headers:{'Content-Type':'text/html','X-Robots-Tag':'noindex','Content-Length':'999'}}),links);
  const reader=response.body.getReader(); let delivered='';
  while(!/כל החופשה, במקום אחד/.test(delivered)) { const next=await reader.read(); assert.equal(next.done,false); delivered+=new TextDecoder().decode(next.value); }
  assert.match(delivered,/כל החופשה, במקום אחד/);
  assert.equal(response.headers.get('X-Robots-Tag'),'noindex');assert.equal(response.headers.get('content-length'),null);
  source.enqueue(new TextEncoder().encode('<section>catalog unchanged</section></body></html>'));source.close();
  let tail='';while(true){const next=await reader.read();if(next.done)break;tail+=new TextDecoder().decode(next.value);}
  assert.match(tail,/catalog unchanged/);
});
test('no canonical, a second canonical and a null body retain their existing contract',async()=>{
  assert.equal(await rewriteCanonicalStream(new Response('<h1>ללא כותרת קנונית</h1>'),links).text(),'<h1>ללא כותרת קנונית</h1>');
  const duplicate=input+input;assert.equal(await rewriteCanonicalStream(new Response(duplicate),links).text(),expected+input);
  assert.equal((rewriteCanonicalStream(new Response(null,{status:204}),links)).status,204);
});
test('existing application hreflang links are replaced by one worker-owned set',async()=>{
  const duplicated='<html><head><link rel="canonical" href="/en"><link rel="alternate" href="/" hreflang="he-IL"/><link rel="alternate" hreflang="en" href="/en"></head><body>ok</body></html>';
  const output=await rewriteCanonicalStream(new Response(duplicated),links).text();
  assert.equal((output.match(/hreflang="en"/g)||[]).length,1);
  assert.doesNotMatch(output,/hreflang="he-IL"/);
  assert.match(output,/rel="canonical" href="https:\/\/vii\.spaplus\.co\/en"/);
});
