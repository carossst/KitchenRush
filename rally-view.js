/* Frontal court: a single projection shared by drawing and pointer coordinates. */
(() => {
  'use strict';
  const C=window.KR_RALLY,W=C.width,H=C.height,net=C.config.court.netY*H,base=C.config.court.baselineY*H,far=H*.10;
  function edges(y){const t=y>=net?(y-net)/(base-net):(net-y)/(net-far);return y>=net?{l:W*(.20-.14*t),r:W*(.80+.14*t)}:{l:W*(.20+.10*t),r:W*(.80-.10*t)};}
  function project(x,y){const e=edges(y);return {x:e.l+(e.r-e.l)*x/W,y};}
  function pointerX(canvas,clientX,playerY){const rect=canvas.getBoundingClientRect(),e=edges(playerY);return ((clientX-rect.left)*W/rect.width-e.l)/(e.r-e.l)*W;}
  function draw(canvas,s,lang='fr'){
    const ctx=canvas.getContext('2d'),k=C.config.court.kitchenLineY*H,farK=net-(net-far)*7/22;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#153e35';ctx.fillRect(0,0,W,H);
    function quad(y1,y2,color){const a=edges(y1),b=edges(y2);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.l,y1);ctx.lineTo(a.r,y1);ctx.lineTo(b.r,y2);ctx.lineTo(b.l,y2);ctx.closePath();ctx.fill();}
    quad(far,base,'#477f6a');quad(far,net,'#39715e');quad(farK,k,'#a8b389');
    ctx.strokeStyle='#ecf0d8';ctx.lineWidth=2.3;ctx.lineJoin='round';
    function line(x1,y1,x2,y2){const a=project(x1,y1),b=project(x2,y2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const y of [far,farK,k,base])line(0,y,W,y);
    line(0,far,0,base);line(W,far,W,base);line(W/2,far,W/2,farK);line(W/2,k,W/2,base);
    ctx.font='600 10px system-ui';ctx.letterSpacing='2px';ctx.textAlign='center';ctx.fillStyle='#e5ecd1aa';ctx.fillText('KITCHEN',W/2,net+45);ctx.fillText('KITCHEN',W/2,net-29);ctx.letterSpacing='0px';
    const b=s.ball;
    if(b&&['TRAVELING','LANDED','BOUNCED'].includes(b.state)){
      const t=project(b.targetX,b.targetY);ctx.save();ctx.strokeStyle='#e7f479';ctx.fillStyle='#e7f47933';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(t.x,t.y,20,9,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
      if(b.state!=='TRAVELING'){ctx.fillStyle='#fbffd0';ctx.font='bold 12px system-ui';ctx.fillText(lang==='fr'?'RENVOIE !':'RETURN!',t.x,t.y-23);}
    }
    function athlete(x,y,color,scale,swing){const p=project(x,y);ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ctx.fillStyle='#082d2944';ctx.beginPath();ctx.ellipse(0,3,22,8,0,0,7);ctx.fill();ctx.strokeStyle='#172b2a';ctx.lineWidth=7;ctx.lineCap='round';for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(sign*7,-8);ctx.lineTo(sign*12,0);ctx.stroke();}ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-13,-39,26,30,9);ctx.fill();ctx.fillStyle='#edc2a1';ctx.beginPath();ctx.arc(0,-48,9,0,7);ctx.fill();ctx.strokeStyle='#edc2a1';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(11,-30);ctx.lineTo(swing?28:20,swing?-39:-18);ctx.stroke();ctx.save();ctx.translate(swing?34:24,swing?-43:-22);ctx.rotate(swing?.6:-.3);ctx.fillStyle='#ddec83';ctx.strokeStyle='#eff6bc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-7,8,11,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#183b32';ctx.fillRect(-2,3,4,10);ctx.restore();ctx.restore();}
    athlete(s.opponentX||W/2,C.config.court.opponentY*H,'#df9b7e',.74,String(s.opponentState).startsWith('swing'));
    const e=edges(net);ctx.fillStyle='#102f2855';ctx.fillRect(e.l,net-12,e.r-e.l,23);ctx.strokeStyle='#eef2d4';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.l-4,net-12);ctx.quadraticCurveTo(W/2,net-6,e.r+4,net-12);ctx.stroke();ctx.lineWidth=.7;ctx.strokeStyle='#f2f3d688';for(let x=e.l;x<e.r;x+=10){ctx.beginPath();ctx.moveTo(x,net-10);ctx.lineTo(x,net+10);ctx.stroke();}for(const y of [net-4,net+3,net+10]){ctx.beginPath();ctx.moveTo(e.l,y);ctx.lineTo(e.r,y);ctx.stroke();}ctx.fillStyle='#dae2cc';ctx.fillRect(e.l-4,net-20,4,38);ctx.fillRect(e.r,net-20,4,38);
    athlete(s.playerX||W/2,s.playerY||C.config.court.playerY*H,'#dfee7a',1,String(s.playerState).startsWith('swing'));
    if(b&&!['MISSED','FAULTED'].includes(b.state)){
      const ground=Number.isFinite(b.groundY)?b.groundY:b.targetY,p=project(b.x,ground),height=Math.max(0,ground-b.y);const rad=6+(ground-far)/(base-far)*3;
      ctx.fillStyle='#092f2860';ctx.beginPath();ctx.ellipse(p.x,ground,rad*1.2,rad*.42,0,0,7);ctx.fill();ctx.shadowColor='#edf69a';ctx.shadowBlur=9;ctx.fillStyle='#effc82';ctx.beginPath();ctx.arc(p.x,ground-height,rad,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#537044';for(const [dx,dy] of [[-2,-2],[3,-1],[0,3]]){ctx.beginPath();ctx.arc(p.x+dx,ground-height+dy,1.1,0,7);ctx.fill();}
    }
    ctx.font='600 12px system-ui';ctx.fillStyle='#dce5cd';ctx.textAlign='center';ctx.fillText(lang==='fr'?'↔  PLACE-TOI SOUS LA BALLE':'↔  MOVE TO THE BALL',W/2,H-37);
  }
  window.KR_RALLY_VIEW=Object.freeze({draw,pointerX});
})();
