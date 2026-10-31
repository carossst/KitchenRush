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
test('all ten players rotate once before repetition; shared players keep powers',()=>{for(const edition of ['fr','us']){const e=createEngine(3,edition),ids=[];e.run.level=30;for(let i=0;i<30;i++){ids.push(e.grantPlayer().player);}for(let i=0;i<30;i+=10)assert.equal(new Set(ids.slice(i,i+10)).size,10);for(let i=1;i<30;i++)assert.notEqual(ids[i],ids[i-1]);}const fr=createEngine(4,'fr'),us=createEngine(4,'us');fr.run.level=us.run.level=30;for(let i=0;i<10;i++){const a=fr.grantPlayer(),b=us.grantPlayer();assert.equal(a.power,b.power);if(['khlif','devilliers'].includes(a.player))assert.equal(a.player,b.player);}});
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
  const e=createEngine(42,'fr','left','build','creator',{style:'advanced'}),y=e.run.playerY;
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
  for(const covered of [true,false]){const e=createEngine(3);e.update(800);const r=e.run,b=r.ball;b.state='BOUNCED';b.x=r.playerX;b.y=r.playerY-28;b.groundY=r.playerY;e._executeHit(r,b,0);r.opponentX=covered?b.returnTargetX:30;r.opponentY=covered?b.returnTargetY:167;r.opponentPartnerX=450;r.opponentPartnerY=167;r.opponentReactAt=Infinity;b.hitAt=r.elapsedMs-b.returnTravelMs-1;e.update(TICK);assert.equal(r.winners,covered?0:1);}
});
test('serving keeps both opponents in place and launches from the actual server',()=>{const e=createEngine(2),left=e.run.opponentX,right=e.run.opponentPartnerX;e.update(800);assert.equal(e.run.opponentX,left);assert.equal(e.run.opponentPartnerX,right);assert.equal(e.run.ball.startX,left);});
test('side swaps the starting places and remains the partner assignment',()=>{
  const left=createEngine(2,'fr','left'),right=createEngine(2,'fr','right');assert.equal(left.run.playerX,right.run.partnerX);assert.equal(left.run.partnerX,right.run.playerX);
  right.run.playerX=120;right._moveTeams(right.run,1000);assert.ok(right.run.partnerX<240);assert.equal(right.run.side,'right');
});
test('strategy changes real trajectory, pace and partner positioning',()=>{
  const runs=[];for(const strategy of ['build','drive']){const e=createEngine(2,'fr','left',strategy);e.update(800);const b=e.run.ball;runs.push({e,travel:b.travelMs});b.state='BOUNCED';b.x=e.run.playerX;b.y=e.run.playerY-28;b.groundY=e.run.playerY;e._executeHit(e.run,b,0);}
  assert.ok(runs[0].e.run.ball.returnTravelMs>runs[1].e.run.ball.returnTravelMs);assert.ok(runs[0].e.run.ball.returnTargetY>runs[1].e.run.ball.returnTargetY);assert.ok(runs[0].travel>runs[1].travel);
  for(const {e} of runs){e.run.ball=null;e.run.playerY=460;e._moveTeams(e.run,1000);}assert.ok(runs[0].e.run.partnerY<runs[1].e.run.partnerY);
});
test('all side and strategy combinations replay with identical FR/US rules',()=>{
  for(const side of ['left','right'])for(const strategy of ['build','drive']){const a=createEngine(23,'fr',side,strategy),b=createEngine(23,'us',side,strategy);let ticks=0;while(!a.run.done&&ticks<MAX_TICKS){a.update(TICK);b.update(TICK);ticks++;}assert.equal(a.run.smashes,b.run.smashes);assert.equal(a.run.winners,b.run.winners);assert.equal(replay(23,'fr',ticks,[],side,strategy).score,a.run.smashes);}
  assert.throws(()=>createEngine(1,'fr','unknown','build'),/setup/);assert.throws(()=>createEngine(1,'fr','left','unknown'),/setup/);
});
test('Thomas roles allocate the middle without restricting side choice',()=>{
  for(const side of ['left','right'])for(const role of ['support','creator']){
    const e=createEngine(9,'fr',side,'build',role);
    assert.equal(e._partnerOwns(e.run,240),role==='support');
    assert.equal(e._partnerOwns(e.run,side==='left'?400:80),true);
    assert.equal(e._partnerOwns(e.run,side==='left'?80:400),false);
  }
});
test('attacking partner may take a reachable middle ball only in anchor role',()=>{
  for(const role of ['support','creator']){
    const e=createEngine(2,'fr','left','build',role);e.update(800);const r=e.run,b=r.ball;
    r.playerX=240;r.partnerX=250;r.partnerY=r.playerY;b.state='BOUNCED';b.bouncedAt=r.elapsedMs-200;b.targetX=240;b.x=240;b.y=r.playerY-28;b.groundY=r.playerY;
    e._tryPartnerHit(r,b);assert.equal(b.state,role==='support'?'HIT':'BOUNCED');assert.equal(r.playerX,240);
  }
});
test('anchor role changes partner positioning and never moves the human automatically',()=>{
  const a=createEngine(2,'fr','left','build','support'),b=createEngine(2,'fr','left','build','creator');
  const y=a.run.playerY;a.update(700);b.update(700);assert.ok(a.run.partnerY<b.run.partnerY);assert.equal(a.run.playerY,y);
});
test('all eight tactical choices have deterministic FR/US replays',()=>{
  for(const side of ['left','right'])for(const strategy of ['build','drive'])for(const role of ['support','creator']){
    const a=createEngine(23,'fr',side,strategy,role),b=createEngine(23,'us',side,strategy,role);let ticks=0;
    while(!a.run.done&&ticks<MAX_TICKS){a.update(TICK);b.update(TICK);ticks++;}
    assert.equal(a.run.smashes,b.run.smashes);assert.equal(a.run.winners,b.run.winners);assert.equal(replay(23,'fr',ticks,[],side,strategy,role).score,a.run.smashes);
  }
  assert.throws(()=>createEngine(1,'fr','left','build','unknown'),/setup/);
});

test('horizontal controls can sustain a rally without tracking depth',()=>{
  const e=createEngine(123);const y=e.run.playerY;let count=0;
  for(let i=0;i<12000&&!e.run.done;i++){
    const b=e.run.ball;if(b)e.setTarget(b.targetX,y);
    e.update(TICK);count=e.run.totalSmashed;
    assert.equal(e.run.playerY,y);
  }
  assert.ok(count>=24,`Only ${count} returns`);
});
test('all incoming shots use a stable reception lane even at higher levels',()=>{
  const e=createEngine(42);for(const level of [1,4,12,30]){
    e.run.level=level;e._spawnBall(e.run);const b=e.run.ball;
    assert.equal(b.targetY,e.run.court.playerY*760+10);
    assert.equal(b.bounceVx,0);assert.equal(b.bounceVy,0);
    assert.ok(b.travelMs>=850*.85);assert.equal(b.mustBounce,true);
  }
});
test('contact offset selects left, centre or right ahead and stays inside the court',()=>{
  const e=createEngine(42);const x=e.run.playerX;
  assert.ok(e.aimAt(x-25)<150);assert.equal(e.aimAt(x),240);assert.ok(e.aimAt(x+25)>330);
  assert.equal(e.aimAt(-999),48);assert.equal(e.aimAt(999),432);
});
test('level formations change opponent coverage with bounded movement',()=>{
  const positions=[];
  for(const level of [1,2,3,4]){const e=createEngine(42);e.run.level=level;e._moveTeams(e.run,10000);positions.push([e.run.opponentX,e.run.opponentPartnerX].join(':'));}
  assert.equal(new Set(positions).size,4);
});

test('every FR/US pair activates exactly the same effect, duration and charges',()=>{
  const expected=[['platel','waters'],['rocchi','bright'],['roy','johns'],['enmer','black'],['burnel','patriquin'],['loriot','jw'],['khlif','khlif'],['devilliers','devilliers'],['vernaz','jorja'],['sarcelet','todd']];
  // Test each pair at the same game time, both with a missing life and at full health.
  for(let i=0;i<expected.length;i++)for(const lives of [2,3]){
    const a=createEngine(1,'fr'),b=createEngine(1,'us');a.run.level=b.run.level=30;
    // Queue the real configured pair, rather than deriving one side from the other.
    const catalog=(engine,edition)=>{engine.run.playerQueue=[];const found=[];for(let n=0;n<10;n++)found.push(engine.grantPlayer());return found.find(p=>p.player===expected[i][edition]);};
    const fa=catalog(a,0),ub=catalog(b,1);assert.equal(fa.power,ub.power);
    for(const [engine,id,power] of [[a,fa.player,fa.power],[b,ub.player,ub.power]]){engine.run.elapsedMs=5000;engine.run.lives=lives;engine.run.smashes=0;engine.run.playerQueue=[{id,power}];engine.grantPlayer();}
    assert.equal(JSON.stringify(a.run.assist),JSON.stringify(b.run.assist));
    assert.equal(a.run.lives,b.run.lives);assert.equal(a.run.smashes,b.run.smashes);
  }
});

test('a defended return keeps the same ball and starts at the exact opponent contact',()=>{
  const e=createEngine(5);e.update(800);const r=e.run,b=r.ball;
  b.state='BOUNCED';b.x=r.playerX;b.y=r.playerY-28;b.groundY=r.playerY;e._executeHit(r,b,0);
  const x=b.returnTargetX,y=b.returnTargetY,id=b.id;r.opponentX=x;r.opponentY=y;r.opponentReactAt=Infinity;
  b.hitAt=r.elapsedMs-b.returnTravelMs;e.update(TICK);
  assert.equal(r.winners,0);assert.equal(r.ball,b);assert.equal(b.id,id);assert.equal(b.state,'TRAVELING');
  assert.equal(b.startX,x);assert.equal(b.startY,y);assert.equal(b.x,x);assert.equal(b.y,y);
  assert.equal(r.opponentStroke.x,x);assert.equal(r.opponentStroke.y,y);assert.equal(r.waitUntil,0);
});
test('beginner powers are simple and every identity becomes available at round four',()=>{
  for(const edition of ['fr','us']){
    const e=createEngine(3,edition);let last=null;
    for(let n=0;n<50;n++){const p=e.grantPlayer();assert.ok(['giant','slow','multi'].includes(p.power));assert.notEqual(p.player,last);last=p.player;assert.ok(e.run.playerQueue.length<=10);}
    e.run.playerQueue=[];e.run.level=4;const ids=new Set();for(let n=0;n<10;n++)ids.add(e.grantPlayer().player);assert.equal(ids.size,10);
  }
});
test('team powers have the same charges when the partner returns',()=>{
  const e=createEngine(5);e.update(800);const r=e.run,b=r.ball;r.assist={key:'fire',charges:2,until:12000};
  b.state='BOUNCED';b.bouncedAt=r.elapsedMs-200;b.x=r.partnerX;b.targetX=r.partnerX;b.y=r.partnerY-28;b.groundY=r.partnerY;
  e._tryPartnerHit(r,b);assert.equal(b.state,'HIT');assert.equal(r.assist.charges,1);assert.ok(r.partnerStroke);
});
test('capture pauses scoring, follows the paddle, and releases automatically once',()=>{
  const e=createEngine(8);e.update(800);const r=e.run,b=r.ball;r.totalSmashed=16;r.level=3;r.nextPowerAt=999;
  b.state='BOUNCED';b.x=r.playerX;b.y=r.playerY-28;b.groundY=r.playerY;const before=r.smashes;
  e._executeHit(r,b,0);assert.equal(b.state,'HELD');assert.equal(r.smashes,before);assert.equal(r.capturedRound,3);
  e.setTarget(r.playerX+40);for(let i=0;i<30;i++)e.update(TICK);assert.equal(b.state,'HELD');assert.equal(b.x,r.playerX);
  for(let i=0;i<90;i++)e.update(TICK);assert.equal(b.state,'HIT');assert.equal(r.smashes,before+1);assert.equal(r.totalSmashed,17);
});
test('precision narrows reach and adds exactly one point for either team member',()=>{
  const normal=createEngine(6),precise=createEngine(6,'fr','left','build','creator',{precision:true});
  assert.ok(Math.abs(precise._getAutoHitRange(precise.run)/normal._getAutoHitRange(normal.run)-.72)<1e-9);
  for(const e of [normal,precise]){e.update(800);const r=e.run,b=r.ball;b.state='BOUNCED';b.x=r.playerX;b.y=r.playerY-28;b.groundY=r.playerY;e._executeHit(r,b,0);}
  assert.equal(precise.run.smashes,normal.run.smashes+1);
  for(const e of [normal,precise]){const r=e.run,b=r.ball;b.state='BOUNCED';b.x=r.partnerX;b.y=r.partnerY-28;b.groundY=r.partnerY;r.hitter='partner';e._executeHit(r,b,0);r.hitter=null;}
  assert.equal(precise.run.smashes,normal.run.smashes+2);
});
test('advanced mode alone enables depth targets and varied landing depths',()=>{
  const arcade=createEngine(42),advanced=createEngine(42,'fr','left','build','creator',{style:'advanced'});
  arcade.setTarget(200,450);advanced.setTarget(200,450);assert.equal(arcade.run.targetY,arcade.run.playerY);assert.equal(advanced.run.targetY,450);
  advanced.run.totalSpawned=8;const depths=new Set();for(let n=0;n<15;n++){advanced._spawnBall(advanced.run);depths.add(advanced.run.ball.targetY);}assert.ok(depths.size>3);
});

test('offline and server daily seeds match for the same UTC day and rules',async()=>{
  const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{dailySeed}=await import('../server/model.mjs');
  const context=vm.createContext({window:{location:{hostname:'localhost'}},structuredClone,URLSearchParams,console});
  for(const file of ['config.js','players.js','rally-config.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  for(const day of ['2026-10-31','2026-11-01','2027-01-01'])assert.equal(context.window.KR_RALLY.dailySeed(day),dailySeed(day));
});
