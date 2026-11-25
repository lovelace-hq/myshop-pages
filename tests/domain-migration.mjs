import assert from 'node:assert/strict';
import {onRequest} from '../functions/_middleware.js';
for(const path of ['/', '/mcp', '/v1/models?a=1&a=2', '/missing%20path?q=x%2Fy&empty=']){
 for(const method of ['GET','HEAD','POST']){
  const r=await onRequest({request:new Request('https://mycoffeeshop.pages.dev'+path,{method}),next(){throw new Error('legacy host must redirect before routing')}});
  assert.equal(r.status,301);assert.equal(r.headers.get('Location'),'https://mycoffeeshop.yv3.uk'+path);
 }
}
for(const host of ['mycoffeeshop.yv3.uk','abc123.mycoffeeshop.pages.dev']){
 const r=await onRequest({request:new Request('https://'+host+'/asset.css?x=1'),next:async()=>new Response('asset')});
 assert.equal(r.status,200);assert.equal(await r.text(),'asset');
}
console.log('domain redirects preserve path, query and methods; new and preview hosts stay reachable');
