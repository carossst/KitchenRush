import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,replay,TICK,MAX_TICKS} from '../server/model.mjs';
function play(seed=42,edition='fr',follow=false){
  const engine=createEngine(seed,edition),inputs=[];let state,last='',ticks=0;
  for(;ticks<MAX_TICKS;ticks++){
    const b=engine.run.ball;
    const x=Math.round(Math.max(0,Math.min(480,follow&&b?b.targetX:240))*10)/10;
    const y=Math.round(Math.max(0,Math.min(760,follow&&b?b.targetY:592.8))*10)/10;
    const key=x+':'+y;if(key!==last){inputs.push([ticks,x,y]);last=key;}
    engine.setTarget(x,y);state=engine.update(TICK);if(state.done){ticks++;break;}
  }return {state,ticks,inputs};
}
test('a seeded run replays to the exact same score and ending',()=>{const run=play();const result=replay(42,'fr',run.ticks,run.inputs);assert.equal(result.score,run.state.smashes);assert.equal(result.level,run.state.level);assert.equal(result.winners,run.state.winners);});
test('FR/US share identical gameplay for the same seed and inputs',()=>{const fr=play(91,'fr',true),us=play(91,'us',true);for(const key of ['smashes','lives','level','winners','totalSmashed'])assert.equal(fr.state[key],us.state[key],key);assert.equal(fr.ticks,us.ticks);});
test('following the ball is rewarded, passive play eventually loses',()=>{const passive=play(123,'fr'),active=play(123,'fr',true);assert.equal(passive.state.done,true);assert.equal(passive.state.lives,0);assert.ok(active.state.totalSmashed>passive.state.totalSmashed+10);});
test('all ten players rotate once before repetition; shared players keep powers',()=>{for(const edition of ['fr','us']){const e=createEngine(3,edition),ids=[];for(let i=0;i<30;i++){ids.push(e.grantPlayer().player);}for(let i=0;i<30;i+=10)assert.equal(new Set(ids.slice(i,i+10)).size,10);for(let i=1;i<30;i++)assert.notEqual(ids[i],ids[i-1]);}const fr=createEngine(4,'fr'),us=createEngine(4,'us');for(let i=0;i<10;i++){const a=fr.grantPlayer(),b=us.grantPlayer();assert.equal(a.power,b.power);if(['khlif','devilliers'].includes(a.player))assert.equal(a.player,b.player);}});
test('hit range changes with world depth, without mixing pixels and fractions',()=>{const e=createEngine(1);e.run.ball={groundY:e.run.court.netY*760};const far=e._getAutoHitRange(e.run);e.run.ball.groundY=e.run.court.baselineY*760;const near=e._getAutoHitRange(e.run);assert.ok(near>far);assert.ok(near/far<1.3);});
test('recomputed serve reaches its marker without an end-of-flight teleport',()=>{const e=createEngine(2);e.update(800);const b=e.run.ball,t=b.travelMs/1000;assert.ok(Math.abs(b.startX+b.flightVx*t-b.targetX)<1e-7);assert.ok(Math.abs(b.startY+b.flightVy*t-b.targetY)<1e-7);assert.ok(Math.abs(b.flightLaunchVz*t-.5*b.flightGravity*t*t)<1e-7);});
test('life powers cap at 3 and shield saves exactly one miss',()=>{const e=createEngine(1);e.run.assist={key:'shield',charges:1,until:12000};e._loseLife(e.run);assert.equal(e.run.lives,3);e._loseLife(e.run);assert.equal(e.run.lives,2);for(let i=0;i<30;i++)e.grantPlayer();assert.ok(e.run.lives<=3);});
test('power clocks only advance with simulated game time',()=>{const e=createEngine(1);e.grantPlayer();const before=e.run.elapsedMs;for(let i=0;i<20;i++)e.getState();assert.equal(e.run.elapsedMs,before);});
test('replay rejects incomplete, oversized and malformed logs',()=>{assert.throws(()=>replay(1,'fr',10,[[0,240,592.8]]),/unfinished/);assert.throws(()=>replay(1,'fr',MAX_TICKS+1,[]));for(const inputs of [[[0,Infinity,500]],[[0,-1,500]],[[0,500,500]],[[0,2.22,500]],[[1,240,500],[0,240,500]],[[0,240]],[[0,240,-1]],[[0,240,761]],[[0,240,1.22]]])assert.throws(()=>replay(1,'fr',10,inputs));});
test('return angle still depends on contact placement in doubles',()=>{
  const targets=[];for(const offset of [0,40]){const e=createEngine(42);e.update(800);const b=e.run.ball;b.state='BOUNCED';b.x=e.run.playerX+offset;b.y=e.run.playerY-28;b.groundY=e.run.playerY;e._executeHit(e.run,b,0);targets.push(b.returnTargetX);}assert.ok(targets[1]>targets[0]+100);
});
test('Rush requires five returns and a miss resets the gauge and active effect',()=>{const e=createEngine(1);e.run.rushReturns=4;e.run.rushUntil=0;e.update(800);const b=e.run.ball;b.state='BOUNCED';b.bouncedAt=e.run.elapsedMs;e._executeHit(e.run,b,0);assert.ok(e.run.rushUntil>e.run.elapsedMs);assert.equal(e.run.rushReturns,0);e._loseLife(e.run);assert.equal(e.run.rushUntil,0);assert.equal(e.run.rushReturns,0);});
test('depth changes only at the player request, with court boundaries',()=>{
  const e=createEngine(42),y=e.run.playerY;
  for(let tick=0;tick<60;tick++)e.update(TICK);
  assert.equal(e.run.playerY,y);
  e.setTarget(240,y-120);for(let i=0;i<30;i++)e.update(TICK);
  assert.equal(e.run.playerY,y-120);
  for(let i=0;i<20;i++)e.update(TICK);assert.equal(e.run.playerY,y-120);
  e.setTarget(240,-100);assert.equal(e.run.targetY,e.run.playerMinY);
  e.setTarget(240,10000);assert.equal(e.run.targetY,e.run.playerMaxY);
});
test('giant paddle increases the actual return reach only while active',()=>{
  const e=createEngine(2),normal=e._getAutoHitRange(e.run);
  e.run.assist={key:'giant',until:6000,charges:-1};assert.ok(e._getAutoHitRange(e.run)>normal*1.3);
  e.run.elapsedMs=6000;assert.equal(e._getAutoHitRange(e.run),normal);
});
test('paddle contact uses the same point and instant as the outgoing ball',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');
  const context=vm.createContext({window:{KR_RALLY:{width:480,height:760,config:{court:{netY:.4,baselineY:.88}}}}});
  vm.runInContext(readFileSync(new URL('../rally-view.js',import.meta.url),'utf8'),context);
  const e=createEngine(2);e.update(800);const b=e.run.ball;b.state='BOUNCED';b.x=e.run.playerX;b.y=e.run.playerY-28;b.groundY=e.run.playerY;
  e._executeHit(e.run,b,0);const s=e.getState(),pose=context.window.KR_RALLY_VIEW.contactPose(s);
  assert.equal(s.stroke.at,b.hitAt);assert.equal(pose.x,context.window.KR_RALLY_VIEW.project(b.x,b.groundY).x);assert.equal(pose.y,b.y);
  assert.equal(b.returnStartY-b.returnStartHeight,b.y);assert.equal(pose.contact,true);
});
test('pointer projection preserves both court coordinates at any depth',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');const context=vm.createContext({window:{KR_RALLY:{width:480,height:760,config:{court:{netY:.4,baselineY:.88}}}}});vm.runInContext(readFileSync(new URL('../rally-view.js',import.meta.url),'utf8'),context);const V=context.window.KR_RALLY_VIEW,canvas={getBoundingClientRect:()=>({left:10,top:20,width:240,height:380})};for(const y of [340,480,640]){const p=V.project(160,y),actual=V.pointerPosition(canvas,10+p.x/2,20+y/2);assert.ok(Math.abs(actual.x-160)<1e-8);assert.equal(actual.y,y);}
});
test('doubles starts with two distinct players on each team',()=>{
  const s=createEngine(2).getState();assert.ok(s.playerX<s.partnerX);assert.ok(s.opponentX<s.opponentPartnerX);assert.equal(s.playerY,s.partnerY);
});
test('partner can return a reachable ball without moving the human player',()=>{
  const e=createEngine(2);e.update(800);const r=e.run,b=r.ball,original=[r.playerX,r.playerY];
  b.state='BOUNCED';b.bouncedAt=r.elapsedMs-200;b.x=r.partnerX;b.y=r.partnerY-28;b.groundY=r.partnerY;b.targetX=r.partnerX;
  e._tryPartnerHit(r,b);assert.equal(b.state,'HIT');assert.deepEqual([r.playerX,r.playerY],original);assert.ok(r.partnerStroke);assert.equal(r.stroke,null);
});
test('partner cannot return an unreachable ball or steal a ball from the human',()=>{
  const e=createEngine(2);e.update(800);const r=e.run,b=r.ball;b.state='BOUNCED';b.bouncedAt=r.elapsedMs-200;b.targetX=400;b.x=450;b.y=350;e._tryPartnerHit(r,b);assert.equal(b.state,'BOUNCED');r.playerX=r.partnerX;b.x=r.partnerX;b.y=r.partnerY-28;e._tryPartnerHit(r,b);assert.equal(b.state,'BOUNCED');
});
test('a winner must beat both opponents',()=>{
  for(const covered of [true,false]){const e=createEngine(3);e.update(800);const r=e.run,b=r.ball;b.state='BOUNCED';b.x=r.playerX;b.y=r.playerY-28;b.groundY=r.playerY;e._executeHit(r,b,0);r.opponentX=covered?b.returnTargetX:30;r.opponentPartnerX=450;r.opponentReactAt=Infinity;b.hitAt=r.elapsedMs-b.returnTravelMs-1;e.update(TICK);assert.equal(r.winners,covered?0:1);}
});
test('serving keeps both opponents in place and launches from the actual server',()=>{const e=createEngine(2),left=e.run.opponentX,right=e.run.opponentPartnerX;e.update(800);assert.equal(e.run.opponentX,left);assert.equal(e.run.opponentPartnerX,right);assert.equal(e.run.ball.startX,left);});
