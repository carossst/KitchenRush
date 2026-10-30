/* One projection for the court, pointer, racket and ball contact. */
(() => {
  'use strict';
  const C=window.KR_RALLY,W=C.width,H=C.height;
  const net=C.config.court.netY*H,base=C.config.court.baselineY*H,far=H*.10;
  function edges(y){
    const t=y>=net?(y-net)/(base-net):(net-y)/(net-far);
    return y>=net?{l:W*(.20-.14*t),r:W*(.80+.14*t)}:{l:W*(.20+.10*t),r:W*(.80-.10*t)};
  }
  function project(x,y){const e=edges(y);return {x:e.l+(e.r-e.l)*x/W,y};}
  function pointerPosition(canvas,clientX,clientY,touchOffset=0){
    const rect=canvas.getBoundingClientRect(),y=(clientY-rect.top-touchOffset)*H/rect.height,e=edges(y);
    return {x:((clientX-rect.left)*W/rect.width-e.l)/(e.r-e.l)*W,y};
  }
  function ballPoint(b){const ground=b.groundY??b.targetY,p=project(b.x,ground);return {x:p.x,y:ground-Math.max(0,ground-b.y)};}
  function paddle(ctx,x,y,size=1,angle=-.3){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle='#243f42';ctx.fillRect(-2.5,8*size,5,16);
    ctx.fillStyle='#f2eee0';for(let y=10*size;y<8*size+15;y+=4)ctx.fillRect(-2.5,y,5,1.5);
    ctx.shadowColor='#051d2944';ctx.shadowBlur=4;ctx.fillStyle='#f4b17f';
    ctx.beginPath();ctx.roundRect(-12*size,-19*size,24*size,33*size,8*size);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#244e60';ctx.beginPath();ctx.roundRect(-9*size,-16*size,18*size,27*size,6*size);ctx.fill();
    ctx.strokeStyle='#83b5ba';ctx.lineWidth=.7;
    for(let n=-8;n<=8;n+=4){ctx.beginPath();ctx.moveTo(n*size,-12*size);ctx.lineTo(n*size,6*size);ctx.stroke();}
    ctx.fillStyle='#f3eac9';ctx.fillRect(-6*size,-4*size,12*size,2*size);ctx.restore();
  }
  function contactPose(s){
    const p=project(s.playerX,s.playerY),stroke=s.stroke,age=stroke?s.elapsedMs-stroke.at:Infinity;
    if(age>=0&&age<230){
      const hit=ballPoint(stroke),follow=Math.min(1,age/230);
      return {x:hit.x+Math.sin(follow*Math.PI)*23,y:hit.y-follow*20,angle:-.1-follow*.7,contact:age<65};
    }
    const b=s.ball;
    if(b?.state==='BOUNCED'&&Math.hypot(b.x-s.playerX,b.y-s.playerY)<=(s.hitRange||55)){
      const hit=ballPoint(b),t=Math.min(1,(s.elapsedMs-b.bouncedAt)/160);
      return {x:p.x+22+(hit.x-p.x-22)*t,y:p.y-28+(hit.y-p.y+28)*t,angle:-.3,contact:false};
    }
    return {x:p.x+25,y:p.y-29,angle:-.3,contact:false};
  }
  function draw(canvas,s,lang='fr'){
    const ctx=canvas.getContext('2d'),k=C.config.court.kitchenLineY*H,farK=net-(net-far)*7/22;
    const backdrop=ctx.createLinearGradient(0,0,W,H);backdrop.addColorStop(0,'#284c43');backdrop.addColorStop(1,'#153b35');ctx.fillStyle=backdrop;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffffff05';for(let y=20;y<H;y+=26)ctx.fillRect(0,y,W,1);
    ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.letterSpacing='3px';ctx.fillStyle='#b5c7aa';ctx.fillText('KITCHEN RUSH  /  PICKLEBALL CLUB',W/2,35);ctx.letterSpacing='0px';
    function quad(y1,y2,color){const a=edges(y1),b=edges(y2);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.l,y1);ctx.lineTo(a.r,y1);ctx.lineTo(b.r,y2);ctx.lineTo(b.l,y2);ctx.closePath();ctx.fill();}
    ctx.save();ctx.shadowColor='#061f3255';ctx.shadowBlur=24;ctx.shadowOffsetY=12;quad(far,base,'#397f95');ctx.restore();
    quad(far,net,'#326c80');quad(farK,k,'#dcae86');
    const wash=ctx.createLinearGradient(0,far,0,base);wash.addColorStop(0,'#ffffff00');wash.addColorStop(1,'#b5f6ff18');quad(far,base,wash);
    ctx.strokeStyle='#f4eed9';ctx.lineWidth=2.4;ctx.lineJoin='round';
    function line(x1,y1,x2,y2){const a=project(x1,y1),b=project(x2,y2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const y of [far,farK,k,base])line(0,y,W,y);
    line(0,far,0,base);line(W,far,W,base);line(W/2,far,W/2,farK);line(W/2,k,W/2,base);
    ctx.font='700 10px system-ui';ctx.letterSpacing='3px';ctx.fillStyle='#694e3e99';ctx.fillText('KITCHEN',W/2,net+45);ctx.fillText('KITCHEN',W/2,net-29);ctx.letterSpacing='0px';
    const b=s.ball;
    if(b&&['TRAVELING','LANDED','BOUNCED'].includes(b.state)){
      const t=project(b.targetX,b.targetY);ctx.save();ctx.strokeStyle='#f6efaa';ctx.fillStyle='#faffae20';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(t.x,t.y,21,9,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(t.x-7,t.y);ctx.lineTo(t.x+7,t.y);ctx.moveTo(t.x,t.y-4);ctx.lineTo(t.x,t.y+4);ctx.stroke();ctx.restore();
    }
    const giant=s.assist?.key==='giant',pose=contactPose(s);
    function athlete(x,y,color,scale,racket){
      const p=project(x,y);ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
      ctx.fillStyle='#102b3544';ctx.beginPath();ctx.ellipse(3,4,24,8,0,0,Math.PI*2);ctx.fill();
      // Bent legs and contrasting shoes read as a ready stance, not a pawn.
      ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#173545';ctx.lineWidth=8;
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*7,-16);ctx.lineTo(side*13,-7);ctx.lineTo(side*12,1);ctx.stroke();ctx.strokeStyle='#f5eede';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(side*12,1);ctx.lineTo(side*17,2);ctx.stroke();ctx.strokeStyle='#173545';ctx.lineWidth=8;}
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-12,-42);ctx.quadraticCurveTo(0,-48,12,-42);ctx.lineTo(15,-18);ctx.quadraticCurveTo(0,-12,-14,-18);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff45';ctx.fillRect(-7,-36,3,16);ctx.fillStyle='#1c454e';ctx.fillRect(-13,-18,27,8);
      ctx.fillStyle='#e6b28e';ctx.beginPath();ctx.arc(0,-51,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#293e3d';ctx.beginPath();ctx.arc(-1,-54,9,Math.PI,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f5f0d4';ctx.beginPath();ctx.roundRect(-10,-59,21,5,2);ctx.fill();ctx.fillRect(-13,-56,26,3);
      const localX=(racket.x-p.x)/scale,localY=(racket.y-p.y)/scale;
      ctx.strokeStyle='#e6b28e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(10,-36);ctx.lineTo(localX*.55,-30+(localY+30)*.45);ctx.lineTo(localX,localY+12);ctx.stroke();
      ctx.strokeStyle='#e6b28e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-10,-36);ctx.lineTo(-20,-27);ctx.stroke();ctx.restore();
      paddle(ctx,racket.x,racket.y,racket.size??scale,racket.angle);
    }
    const serving=b?.state==='TRAVELING'&&s.elapsedMs-b.spawnedAt<200;
    for(const side of [0,1]){
      const x=side===0?s.opponentX:s.opponentPartnerX,y=side===0?s.opponentY:s.opponentPartnerY,op=project(x,y);
      const racket=serving&&s.serverSide===side?{x:project(b.startX,b.startY).x,y:b.startY-30,angle:.1,size:.74}:{x:op.x+18,y:op.y-24,angle:.35,size:.74};
      athlete(x,y,'#f3a079',.78,racket);
    }
    const e=edges(net);ctx.fillStyle='#14333d55';ctx.fillRect(e.l,net-12,e.r-e.l,25);ctx.strokeStyle='#f4f1df';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(e.l-4,net-12);ctx.quadraticCurveTo(W/2,net-6,e.r+4,net-12);ctx.stroke();ctx.lineWidth=.6;ctx.strokeStyle='#d2e0d9aa';
    for(let x=e.l;x<e.r;x+=9){ctx.beginPath();ctx.moveTo(x,net-10);ctx.lineTo(x,net+13);ctx.stroke();}
    for(const y of [net-4,net+4,net+12]){ctx.beginPath();ctx.moveTo(e.l,y);ctx.lineTo(e.r,y);ctx.stroke();}
    ctx.fillStyle='#e5ddc6';ctx.fillRect(e.l-4,net-21,4,40);ctx.fillRect(e.r,net-21,4,40);
    if(giant){const p=project(s.playerX,s.playerY);ctx.strokeStyle='#eef3a788';ctx.fillStyle='#eef3a714';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,48,15,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
    const partnerPose=contactPose({...s,playerX:s.partnerX,playerY:s.partnerY,stroke:s.partnerStroke,ball:null});
    const partnerScale=.78+.25*(s.partnerY-net)/(base-net);
    athlete(s.partnerX,s.partnerY,'#83c7c0',partnerScale,{...partnerPose,size:1});
    const partnerLabel=project(s.partnerX,s.partnerY);
    ctx.font='700 9px system-ui';ctx.fillStyle='#c5f4e9';ctx.fillText(lang==='fr'?'PARTENAIRE':'PARTNER',partnerLabel.x,partnerLabel.y-73*partnerScale);
    const playerScale=.78+.25*(s.playerY-net)/(base-net);
    athlete(s.playerX??W/2,s.playerY??C.config.court.playerY*H,'#e5ef94',playerScale,{...pose,size:giant?1.65:1});
    const playerLabel=project(s.playerX,s.playerY);ctx.font='700 10px system-ui';ctx.fillStyle='#f3f9b1';ctx.fillText(lang==='fr'?'TOI':'YOU',playerLabel.x,playerLabel.y-73*playerScale);
    if(pose.contact){ctx.strokeStyle='#fff8c3';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pose.x,pose.y,15,0,Math.PI*2);ctx.stroke();}
    if(b&&!['MISSED','FAULTED'].includes(b.state)){
      const ground=b.groundY??b.targetY,p=ballPoint(b),shadow=project(b.x,ground),rad=6+(ground-far)/(base-far)*3;
      ctx.fillStyle='#102c3c55';ctx.beginPath();ctx.ellipse(shadow.x,ground,rad*1.3,rad*.4,0,0,Math.PI*2);ctx.fill();
      ctx.shadowColor='#eaff9a';ctx.shadowBlur=8;ctx.fillStyle='#f0ff83';ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#587547';for(const [dx,dy] of [[-2,-2],[3,-1],[0,3]]){ctx.beginPath();ctx.arc(p.x+dx,p.y+dy,1.2,0,Math.PI*2);ctx.fill();}
    }
    ctx.font='600 11px system-ui';ctx.fillStyle='#dce5cd';ctx.textAlign='center';ctx.fillText(lang==='fr'?'↔  ↕  DÉPLACE-TOI LIBREMENT':'↔  ↕  MOVE IN ANY DIRECTION',W/2,H-33);
  }
  function drawPowerPreview(canvas,power,lang){
    canvas.hidden=power!=='giant';if(canvas.hidden)return;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,280,90);ctx.fillStyle='#e4e9d9';ctx.beginPath();ctx.roundRect(0,0,280,90,12);ctx.fill();
    paddle(ctx,64,42,1);paddle(ctx,207,42,1.65);ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#37594c';ctx.fillText(lang==='fr'?'NORMALE':'NORMAL',64,80);ctx.fillText(lang==='fr'?'PLUS GRANDE':'BIGGER',207,80);ctx.font='24px system-ui';ctx.fillText('→',135,48);
  }
  window.KR_RALLY_VIEW=Object.freeze({draw,pointerPosition,project,contactPose,drawPowerPreview});
})();
