import test from 'node:test';
import assert from 'node:assert/strict';
import {videoId,seconds,timestamp,validRange} from '../src/logic.ts';
test('supported YouTube links and unrelated domains',()=>{
  const id='M7lc1UVf-VE';
  for(const url of ['www.youtube.com/watch?v='+id,'https://youtu.be/'+id+'?t=3','https://m.youtube.com/shorts/'+id]) assert.equal(videoId(url),id);
  for(const url of ['https://youtube.com.example/watch?v='+id,'https://youtu.be/bad','']) assert.equal(videoId(url),null);
});
test('time editing and range boundaries',()=>{
  assert.equal(seconds('1:12'),72);
  assert.equal(seconds(timestamp(85.125)),85.125);
  for(const s of ['','1:60','-1','abc']) assert.ok(Number.isNaN(seconds(s)));
  assert.ok(validRange(0,85,85));
  for(const [a,b] of [[5,5],[5,3],[-1,3],[0,86],[NaN,5]]) assert.equal(validRange(a,b,85),false);
});
