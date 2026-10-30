/* Presentation only: bounded effects, simulation-clock animation, optional synthesized audio. */
(() => {
  'use strict';
  const V=window.KR_RALLY_VIEW;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  function createFeedback(){
    let previous=null,events=[],trail=[],lastBall=null;
    const add=(kind,at,x,y,text='')=>{events.push({kind,at,x,y,text});events=events.slice(-16);};
    function reset(){previous=null;events=[];trail=[];lastBall=null;}
    function observe(s,lang='fr'){
      if(previous&&s.elapsedMs<previous.elapsedMs)reset();
      const b=s.ball;
      if(b&&b.id!==lastBall){trail=[];lastBall=b.id;}
      if(b&&!['MISSED','FAULTED'].includes(b.state)){
        const point=V.ballPoint(b);trail.push({...point,at:s.elapsedMs});trail=trail.filter(p=>s.elapsedMs-p.at<=130).slice(-9);
      }else trail=[];
      if(previous){
        for(const key of ['stroke','partnerStroke'])if(s[key]&&s[key].at!==previous[key]?.at){const p=V.ballPoint(s[key]);add('hit',s[key].at,p.x,p.y);add('score',s[key].at,p.x,p.y-25,'+'+Math.max(1,(s.smashes||0)-(previous.smashes||0)));}
        if(b?.landedAt>0&&(b.id!==previous.ball?.id||b.landedAt!==previous.ball?.landedAt)){const p=V.project(b.targetX,b.targetY);add('bounce',b.landedAt,p.x,p.y);}
        if(s.winners>previous.winners)add('winner',s.elapsedMs,240,62,lang==='fr'?'COUP GAGNANT  +3':'WINNER  +3');
        if(s.level>previous.level)add('round',s.elapsedMs,240,62,(lang==='fr'?'MANCHE ':'ROUND ')+s.level);
        if(s.lives<previous.lives)add('miss',s.elapsedMs,240,700);
        if(s.powerEvent?.serial!==previous.powerEvent?.serial&&s.powerEvent)add('power',s.elapsedMs,240,62,s.powerEvent.power==='life'?(s.lives>previous.lives?(lang==='fr'?'+1 VIE':'+1 LIFE'):(lang==='fr'?'VIES PLEINES · +2':'FULL LIVES · +2')):(lang==='fr'?'POUVOIR ACTIVÉ':'POWER ON'));
      }
      events=events.filter(e=>s.elapsedMs-e.at<900);
      previous={smashes:s.smashes||0,elapsedMs:s.elapsedMs,stroke:s.stroke,partnerStroke:s.partnerStroke,ball:b,level:s.level,winners:s.winners,lives:s.lives,powerEvent:s.powerEvent};
    }
    function draw(ctx,s){
      ctx.save();ctx.lineCap='round';
      const hot=['fire','bomb'].includes(s.assist?.key),rush=s.rushUntil>s.elapsedMs;
      if(!reduced&&trail.length>1)for(let i=1;i<trail.length;i++){
        ctx.globalAlpha=(i/trail.length)*.38;ctx.strokeStyle=hot?'#ffad69':rush?'#caff8a':'#e6ffd2';ctx.lineWidth=1+i*.65;
        ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.stroke();
      }
      ctx.globalAlpha=1;
      for(const e of events){
        const age=s.elapsedMs-e.at;if(age<0)continue;
        if(e.kind==='hit'&&age<180){
          ctx.strokeStyle=hot?'#ffc080':'#ffffd7';ctx.lineWidth=2;ctx.globalAlpha=1-age/180;
          const radius=reduced?13:10+age*.09;
          for(let n=0;n<6;n++){const a=n*Math.PI/3;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius);ctx.lineTo(e.x+Math.cos(a)*(radius+6),e.y+Math.sin(a)*(radius+6));ctx.stroke();}
        }else if(e.kind==='bounce'&&age<300){
          ctx.globalAlpha=(1-age/300)*.75;ctx.strokeStyle='#f4ffd8';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,reduced?18:12+age*.07,5+age*.02,0,0,Math.PI*2);ctx.stroke();
        }else if(e.kind==='score'&&age<600){
          ctx.globalAlpha=1-age/600;ctx.fillStyle='#ffffdc';ctx.font='800 16px system-ui';ctx.textAlign='center';ctx.fillText(e.text,e.x,e.y-(reduced?0:age*.035));
        }else if(['winner','round','power'].includes(e.kind)){
          ctx.globalAlpha=Math.min(1,(900-age)/180);ctx.fillStyle=e.kind==='winner'?'#e5f68e':'#143c36';ctx.beginPath();ctx.roundRect(113,44,254,32,10);ctx.fill();ctx.fillStyle=e.kind==='winner'?'#163d35':'#f0f4dc';ctx.font='800 13px system-ui';ctx.textAlign='center';ctx.fillText(e.text,240,65);
        }else if(e.kind==='miss'&&age<300){ctx.globalAlpha=(1-age/300)*.6;ctx.strokeStyle='#ff9c80';ctx.lineWidth=4;ctx.strokeRect(5,5,470,750);}
      }
      ctx.restore();
    }
    return {reset,observe,draw,snapshot:()=>({events:events.map(e=>({...e})),trailLength:trail.length})};
  }
  function createSound(){
    let context=null,enabled=false,last=-Infinity;
    function setEnabled(value){enabled=!!value;if(!enabled&&context)void context.suspend().catch(()=>{});}
    function unlock(){
      if(!enabled)return;
      try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context??=new Audio();void context.resume().catch(()=>{});}catch{/* Audio is optional. */}
    }
    function play(kind){
      if(!enabled||!context||context.state!=='running')return;
      const now=context.currentTime;if(now-last<.035)return;last=now;
      const notes={hit:[520,310,.065],bounce:[230,160,.045],winner:[660,990,.16],power:[440,880,.13],miss:[190,95,.16]};
      const [from,to,length]=notes[kind]||notes.hit;
      try{const osc=context.createOscillator(),gain=context.createGain();osc.type=kind==='winner'?'sine':'triangle';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+length);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.005);gain.gain.exponentialRampToValueAtTime(.0001,now+length);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+length+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch{/* A blocked sound must never stop a rally. */}
    }
    return {setEnabled,unlock,play};
  }
  window.KR_RALLY_FEEDBACK=createFeedback();window.KR_RALLY_SOUND=createSound();window.KR_CREATE_FEEDBACK=createFeedback;
})();
