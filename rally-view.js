/* One projection for the court, pointer, racket and ball contact. */
(() => {
  'use strict';
  const C=window.KR_RALLY,W=C.width,H=C.height;
  const net=C.config.court.netY*H,base=C.config.court.baselineY*H,far=H*.10;
  function edges(y){
    const t=y>=net?(y-net)/(base-net):(net-y)/(net-far);
    return y>=net?{l:W*(.12-.05*t),r:W*(.88+.05*t)}:{l:W*(.12+.02*t),r:W*(.88-.02*t)};
  }
  function project(x,y){const e=edges(y);return {x:e.l+(e.r-e.l)*x/W,y};}
  function pointerPosition(canvas,clientX,clientY,touchOffset=0){
    const rect=canvas.getBoundingClientRect(),y=(clientY-rect.top-touchOffset)*H/rect.height,e=edges(y);
    return {x:((clientX-rect.left)*W/rect.width-e.l)/(e.r-e.l)*W,y};
  }
  function ballPoint(b){const ground=b.groundY??b.targetY,p=project(b.x,ground);return {x:p.x,y:ground-Math.max(0,ground-b.y)};}
  function paddle(ctx,x,y,size=1,angle=-.3){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle='#dce8f3';ctx.beginPath();ctx.roundRect(-3,7*size,6,17,3);ctx.fill();
    ctx.fillStyle='#adff5f';ctx.shadowColor='#adff5f66';ctx.shadowBlur=8;
    ctx.beginPath();ctx.roundRect(-12*size,-19*size,24*size,33*size,9*size);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#122133';ctx.beginPath();ctx.roundRect(-9*size,-16*size,18*size,26*size,6*size);ctx.fill();
    ctx.fillStyle='#adff5f';ctx.beginPath();ctx.moveTo(-5*size,-10*size);ctx.lineTo(5*size,-4*size);ctx.lineTo(-3*size,4*size);ctx.closePath();ctx.fill();ctx.restore();
  }
  function contactPose(s){
    const p=project(s.playerX,s.playerY),stroke=s.stroke,age=stroke?s.elapsedMs-stroke.at:Infinity;
    if(age>=0&&age<230){
      const hit=ballPoint(stroke),follow=Math.min(1,age/230);
      return {x:hit.x+Math.sin(follow*Math.PI)*23,y:hit.y-follow*20,angle:-.1-follow*.7,contact:age<65};
    }
    const b=s.ball;
    if(b?.state==='HELD'){const hit=ballPoint(b);return {x:hit.x,y:hit.y,angle:-.3,contact:true};}
    if(b?.state==='BOUNCED'&&Math.hypot(b.x-s.playerX,b.y-s.playerY)<=(s.hitRange||55)){
      const hit=ballPoint(b),t=Math.min(1,(s.elapsedMs-b.bouncedAt)/160);
      return {x:p.x+22+(hit.x-p.x-22)*t,y:p.y-28+(hit.y-p.y+28)*t,angle:-.3,contact:false};
    }
    return {x:p.x+25,y:p.y-29,angle:-.3,contact:false};
  }
  const positions=new WeakMap();
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  function draw(canvas,s,lang='fr'){
    const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    if(canvas.width!==W*ratio||canvas.height!==H*ratio){canvas.width=W*ratio;canvas.height=H*ratio;}
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    const k=C.config.court.kitchenLineY*H,farK=net-(net-far)*7/22;
    const last=positions.get(canvas);
    const moved=(x,y,oldX,oldY)=>!reduced&&last&&s.elapsedMs>last.at&&Math.hypot(x-oldX,y-oldY)>.3;
    const playerMoving=moved(s.playerX,s.playerY,last?.playerX,last?.playerY),partnerMoving=moved(s.partnerX,s.partnerY,last?.partnerX,last?.partnerY);
    positions.set(canvas,{at:s.elapsedMs,playerX:s.playerX,playerY:s.playerY,partnerX:s.partnerX,partnerY:s.partnerY,opponentX:s.opponentX,opponentY:s.opponentY,opponentPartnerX:s.opponentPartnerX,opponentPartnerY:s.opponentPartnerY});
    const themes=[['#123e50','#153348','#25435e'],['#203e5f','#182d4f','#363857'],['#164c49','#153d40','#2b435d']];
    const theme=themes[Math.floor(((s.level||1)-1)/2)%themes.length];
    const backdrop=ctx.createLinearGradient(0,0,W,H);backdrop.addColorStop(0,'#0a1424');backdrop.addColorStop(1,'#070e1b');ctx.fillStyle=backdrop;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffffff03';for(let x=20;x<W;x+=48)for(let y=20;y<H;y+=48)ctx.fillRect(x,y,1,1);
    ctx.strokeStyle='#44658844';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(12,12,W-24,H-24,15);ctx.stroke();
    ctx.fillStyle='#aaff5e';ctx.fillRect(24,28,5,5);ctx.fillStyle='#ffffff';ctx.font='800 12px system-ui';ctx.textAlign='left';ctx.fillText('KITCHEN RUSH',38,35);
    ctx.textAlign='center';ctx.font='700 10px system-ui';ctx.fillStyle='#8ea7c6';ctx.fillText(lang==='fr'?'DOUBLE / ARCADE':'DOUBLES / ARCADE',W-99,35);
    function quad(y1,y2,color){const a=edges(y1),b=edges(y2);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.l,y1);ctx.lineTo(a.r,y1);ctx.lineTo(b.r,y2);ctx.lineTo(b.l,y2);ctx.closePath();ctx.fill();}
    ctx.save();ctx.shadowColor='#061f3255';ctx.shadowBlur=24;ctx.shadowOffsetY=12;quad(far,base,theme[0]);ctx.restore();
    quad(far,net,theme[1]);quad(farK,k,theme[2]);
    const wash=ctx.createLinearGradient(0,far,0,base);wash.addColorStop(0,'#ffffff00');wash.addColorStop(1,'#b5f6ff18');quad(far,base,wash);
    ctx.strokeStyle='#c3e8ef';ctx.lineWidth=2.4;ctx.lineJoin='round';
    function line(x1,y1,x2,y2){const a=project(x1,y1),b=project(x2,y2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const y of [far,farK,k,base])line(0,y,W,y);
    line(0,far,0,base);line(W,far,W,base);line(W/2,far,W/2,farK);line(W/2,k,W/2,base);
    ctx.font='700 10px system-ui';ctx.letterSpacing='3px';ctx.fillStyle='#96b4d466';ctx.fillText('KITCHEN',W/2,net+45);ctx.fillText('KITCHEN',W/2,net-29);ctx.letterSpacing='0px';
    const b=s.ball;
    if(b&&['TRAVELING','LANDED','BOUNCED'].includes(b.state)){
      const t=project(b.targetX,b.targetY);ctx.save();ctx.strokeStyle='#f6efaa';ctx.fillStyle='#faffae20';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(t.x,t.y,21,9,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(t.x-7,t.y);ctx.lineTo(t.x+7,t.y);ctx.moveTo(t.x,t.y-4);ctx.lineTo(t.x,t.y+4);ctx.stroke();ctx.restore();
    }
    // The reception rail makes the contact width and left/right control visible.
    const railY=s.playerY-28,railLeft=project(Math.max(0,s.playerX-(s.hitRange||35)),s.playerY),railRight=project(Math.min(W,s.playerX+(s.hitRange||35)),s.playerY);
    ctx.save();ctx.strokeStyle='#ebf79e';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(railLeft.x,railY);ctx.lineTo(railRight.x,railY);ctx.stroke();ctx.restore();
    ctx.font='700 10px system-ui';ctx.fillStyle='#8ea7c6';ctx.fillText(lang==='fr'?'↑ VISE LES ESPACES ↑':'↑ AIM FOR THE GAPS ↑',W/2,far-15);
    if(b&&['TRAVELING','LANDED','BOUNCED','HIT'].includes(b.state)){
      const outgoing=b.state==='HIT',aimX=outgoing?b.returnTargetX:s.aimX;
      if(Number.isFinite(aimX)){
        const aimY=outgoing?b.returnTargetY:(s.strategy==='build'?net-48:C.config.court.opponentY*H-30),goal=project(aimX,aimY);
        ctx.save();ctx.strokeStyle=outgoing?'#f2ffa4':'#f2ffa477';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(goal.x,goal.y,16,7,0,0,Math.PI*2);ctx.stroke();
        if(!outgoing&&Math.abs(b.targetX-s.playerX)<=(s.hitRange||35)){
          const from=project(s.playerX,s.playerY);ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(from.x,railY);ctx.lineTo(goal.x,goal.y);ctx.stroke();
        }
        ctx.restore();
      }
    }
    if(!b||['TRAVELING','LANDED','BOUNCED'].includes(b.state)){
      const aimY=s.strategy==='build'?net-48:C.config.court.opponentY*H-30;
      const candidates=[64,240,416],distance=x=>Math.min(Math.hypot(x-s.opponentX,aimY-s.opponentY),Math.hypot(x-s.opponentPartnerX,aimY-s.opponentPartnerY));
      const gap=candidates.reduce((best,x)=>distance(x)>distance(best)?x:best),p=project(gap,aimY);
      ctx.save();ctx.fillStyle='#adff5f12';ctx.strokeStyle='#adff5f77';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(p.x-26,p.y-19,52,38,12);ctx.fill();ctx.stroke();
      ctx.fillStyle='#c2ff8d';ctx.font='800 9px system-ui';ctx.fillText(lang==='fr'?'VISE ICI':'AIM HERE',p.x,p.y-26);ctx.restore();
    }
    const giant=s.assist?.key==='giant',pose=contactPose(s);
    function athlete(x,y,color,scale,racket,moving=false){
      const p=project(x,y),stride=moving?Math.sin(s.elapsedMs*.028)*5:0;
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
      ctx.fillStyle='#02071066';ctx.beginPath();ctx.ellipse(0,4,23,8,0,0,Math.PI*2);ctx.fill();
      ctx.lineCap='round';ctx.lineJoin='round';
      for(const side of [-1,1]){
        ctx.strokeStyle='#182638';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(side*7,-18);ctx.lineTo(side*13,side*stride);ctx.stroke();
        ctx.strokeStyle='#e4f1ff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(side*13,side*stride);ctx.lineTo(side*18,side*stride+1);ctx.stroke();
      }
      ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-16,-44,32,31,10);ctx.fill();
      ctx.fillStyle='#ffffff22';ctx.beginPath();ctx.roundRect(-12,-41,10,24,5);ctx.fill();
      ctx.fillStyle='#101c2b';ctx.fillRect(-14,-17,28,8);
      ctx.font='900 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#0d2232';ctx.fillText(color==='#adff5f'?'1':color==='#5cdaf5'?'2':'•',3,-26);
      ctx.fillStyle='#d9a07b';ctx.beginPath();ctx.arc(0,-52,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#172638';ctx.beginPath();ctx.arc(0,-55,10,Math.PI,Math.PI*2);ctx.fill();
      ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-11,-61,23,5,2);ctx.fill();ctx.fillRect(2,-58,13,3);
      const rx=(racket.x-p.x)/scale,ry=(racket.y-p.y)/scale;
      ctx.strokeStyle='#d9a07b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(13,-36);ctx.lineTo(rx*.6,-28+(ry+28)*.5);ctx.lineTo(rx,ry+10);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-13,-36);ctx.lineTo(-22,-27);ctx.stroke();ctx.restore();
      paddle(ctx,racket.x,racket.y,racket.size??scale,racket.angle);
    }
    const serving=b?.state==='TRAVELING'&&s.elapsedMs-b.spawnedAt<200;
    for(const side of [0,1]){
      const x=side===0?s.opponentX:s.opponentPartnerX,y=side===0?s.opponentY:s.opponentPartnerY,op=project(x,y);
      const stroke=s.opponentStroke,age=stroke?s.elapsedMs-stroke.at:Infinity,contact=stroke?.side===side&&age>=0&&age<230;
      const racket=contact?{x:project(stroke.x,stroke.groundY).x,y:stroke.y-Math.sin(age/230*Math.PI)*12,angle:.1,size:.74}:serving&&s.serverSide===side?{x:project(b.startX,b.startY).x,y:b.startY-30,angle:.1,size:.74}:{x:op.x+18,y:op.y-24,angle:.35,size:.74};
      athlete(x,y,side===0?'#ff7e95':'#b797ff',.78,racket,moved(x,y,side===0?last?.opponentX:last?.opponentPartnerX,side===0?last?.opponentY:last?.opponentPartnerY));
    }
    const e=edges(net);ctx.fillStyle='#14333d55';ctx.fillRect(e.l,net-12,e.r-e.l,25);ctx.strokeStyle='#c4eaf6';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(e.l-4,net-12);ctx.quadraticCurveTo(W/2,net-6,e.r+4,net-12);ctx.stroke();ctx.lineWidth=.6;ctx.strokeStyle='#d2e0d9aa';
    for(let x=e.l;x<e.r;x+=9){ctx.beginPath();ctx.moveTo(x,net-10);ctx.lineTo(x,net+13);ctx.stroke();}
    for(const y of [net-4,net+4,net+12]){ctx.beginPath();ctx.moveTo(e.l,y);ctx.lineTo(e.r,y);ctx.stroke();}
    ctx.fillStyle='#95cadb';ctx.fillRect(e.l-4,net-21,4,40);ctx.fillRect(e.r,net-21,4,40);
    if(giant){const p=project(s.playerX,s.playerY);ctx.strokeStyle='#eef3a788';ctx.fillStyle='#eef3a714';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,48,15,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
    const partnerPose=contactPose({...s,playerX:s.partnerX,playerY:s.partnerY,stroke:s.partnerStroke,ball:null});
    const partnerScale=.78+.25*(s.partnerY-net)/(base-net);
    athlete(s.partnerX,s.partnerY,'#5cdaf5',partnerScale,{...partnerPose,size:giant?1.65:1},partnerMoving);
    const partnerLabel=project(s.partnerX,s.partnerY);
    ctx.font='700 9px system-ui';ctx.fillStyle='#c5f4e9';ctx.fillText(lang==='fr'?'PARTENAIRE':'PARTNER',partnerLabel.x,partnerLabel.y-73*partnerScale);
    const playerScale=.78+.25*(s.playerY-net)/(base-net);
    athlete(s.playerX??W/2,s.playerY??C.config.court.playerY*H,'#adff5f',playerScale,{...pose,size:giant?1.65:1},playerMoving);
    const playerLabel=project(s.playerX,s.playerY);ctx.font='700 10px system-ui';ctx.fillStyle='#f3f9b1';ctx.fillText(lang==='fr'?'TOI':'YOU',playerLabel.x,playerLabel.y-73*playerScale);
    const active=s.assist?.key;
    if(active){const p=project(s.playerX,s.playerY);ctx.save();
      const colors={shield:'#b5e8ee',speed:'#e8f298',slow:'#cbb8ef',multi:'#a4e9df',fire:'#ffaf70',bomb:'#ff9878',storm:'#c4d8f5',giant:'#edf6a7'};
      ctx.strokeStyle=colors[active]||'#edf6a7';ctx.lineWidth=2;
      if(active==='shield'){ctx.fillStyle='#b5e8ee15';ctx.beginPath();ctx.ellipse(p.x,p.y-30,36,49,0,Math.PI,Math.PI*2);ctx.stroke();ctx.fill();}
      else if(active==='speed'){for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(p.x-30-n*7,p.y-15+n*5);ctx.lineTo(p.x-45-n*7,p.y-15+n*5);ctx.stroke();}}
      else if(active==='multi'){ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(p.x,p.y,38,12,0,0,Math.PI*2);ctx.stroke();}
      if(active==='slow'){ctx.beginPath();ctx.arc(p.x,p.y-82,9,0,Math.PI*2);ctx.moveTo(p.x,p.y-89);ctx.lineTo(p.x,p.y-82);ctx.lineTo(p.x+5,p.y-79);ctx.stroke();}
      if(active==='storm'){for(const dx of [-1,1]){ctx.beginPath();ctx.moveTo(p.x+dx*25,p.y-15);ctx.lineTo(p.x+dx*43,p.y-27);ctx.lineTo(p.x+dx*34,p.y-27);ctx.moveTo(p.x+dx*43,p.y-27);ctx.lineTo(p.x+dx*39,p.y-18);ctx.stroke();}}
      if(['fire','bomb'].includes(active)){ctx.shadowColor=colors[active];ctx.shadowBlur=12;ctx.beginPath();ctx.arc(pose.x,pose.y,23,0,Math.PI*2);ctx.stroke();}
      ctx.restore();}
    window.KR_RALLY_FEEDBACK?.draw(ctx,s);
    if(b&&!['MISSED','FAULTED'].includes(b.state)){
      const ground=b.groundY??b.targetY,p=ballPoint(b),shadow=project(b.x,ground),rad=6+(ground-far)/(base-far)*3;
      ctx.fillStyle='#102c3c55';ctx.beginPath();ctx.ellipse(shadow.x,ground,rad*1.3,rad*.4,0,0,Math.PI*2);ctx.fill();
      ctx.shadowColor='#eaff9a';ctx.shadowBlur=12;ctx.fillStyle='#f0ff83';ctx.strokeStyle='#173b3d';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(p.x,p.y,rad+1,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
      ctx.fillStyle='#587547';for(const [dx,dy] of [[-2,-2],[3,-1],[0,3]]){ctx.beginPath();ctx.arc(p.x+dx,p.y+dy,1.2,0,Math.PI*2);ctx.fill();}
    }
    const progress=(s.totalSmashed||0)%8;
    for(let i=0;i<8;i++){ctx.fillStyle=i<progress?'#adff5f':'#24354b';ctx.beginPath();ctx.roundRect(112+i*33,H-61,25,5,3);ctx.fill();}
    ctx.font='600 11px system-ui';ctx.fillStyle='#dce5cd';ctx.textAlign='center';ctx.fillText(lang==='fr'?(s.style==='advanced'?'← → ↑ ↓ · PROFONDEUR LIBRE':'← → · PLACE-TOI · VISE EN FACE'):(s.style==='advanced'?'← → ↑ ↓ · MOVE IN DEPTH':'← → · MOVE · AIM AHEAD'),W/2,H-33);
  }
  function drawPowerPreview(canvas,power,lang){
    canvas.hidden=power!=='giant';if(canvas.hidden)return;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,280,90);ctx.fillStyle='#15263b';ctx.beginPath();ctx.roundRect(0,0,280,90,12);ctx.fill();
    paddle(ctx,64,42,1);paddle(ctx,207,42,1.65);ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#c8d9ef';ctx.fillText(lang==='fr'?'NORMALE':'NORMAL',64,80);ctx.fillText(lang==='fr'?'PLUS GRANDE':'BIGGER',207,80);ctx.font='24px system-ui';ctx.fillText('→',135,48);
  }
  window.KR_RALLY_VIEW=Object.freeze({draw,pointerPosition,project,contactPose,drawPowerPreview,ballPoint});
})();
