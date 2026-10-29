/* Extends the original exchange engine rather than replacing it with brick physics. */
(() => {
  'use strict';
  const C=window.KR_RALLY, Base=window.KR_Game.GameEngine, B=window.KR_Game.BALL_STATES;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function flight(ball,prefix,startX,startY,targetX,targetY,ms,arc,startHeight=0){
    const t=ms/1000;
    Object.assign(ball,{[prefix+'StartX']:startX,[prefix+'StartY']:startY,[prefix+'TargetX']:targetX,[prefix+'TargetY']:targetY});
    if(!prefix){ball.startX=startX;ball.startY=startY;ball.targetX=targetX;ball.targetY=targetY;ball.travelMs=ms;ball.arcHeight=arc;ball.flightStartHeight=startHeight;ball.flightVx=(targetX-startX)/t;ball.flightVy=(targetY-startY)/t;ball.flightGravity=8*arc/t**2;ball.flightLaunchVz=4*arc/t;}
    else{ball.returnTravelMs=ms;ball.returnStartHeight=startHeight;ball.returnVx=(targetX-startX)/t;ball.returnVy=(targetY-startY)/t;ball.returnGravity=8*arc/t**2;ball.returnLaunchVz=4*arc/t;}
  }
  class RallyEngine extends Base {
    start({seed=1,edition='fr'}={}){
      super.start({config:C.config,canvasW:C.width,canvasH:C.height,mode:'RUN',isDaily:false});
      const r=this.run;r.rng=C.random(seed);r.edition=edition;r.level=1;r.winners=0;r.assist=null;r.powerEvent=null;r.powerSerial=0;r.rushUntil=0;r.rushReturns=0;r.nextPowerAt=4;r.playerQueue=[];r.lastPlayer=null;r.targetX=C.width/2;r.targetY=r.playerY;r.stroke=null;r.nextStartX=null;r.lastWinnerAt=-9999;
      return this.getState();
    }
    setTarget(x,y=this.run.targetY){
      const r=this.run;
      r.targetX=clamp(Number(x)||0,20,C.width-20);
      r.targetY=clamp(Number.isFinite(y)?y:r.targetY,r.playerMinY,r.playerMaxY);
    }
    update(dt){
      const r=this.run;if(!r||r.done)return this.getState();
      if(r.assist&&r.elapsedMs>=r.assist.until)r.assist=null;
      r.level=Math.min(30,1+Math.floor(r.totalSmashed/8));
      const speed=this._getEffectiveMoveSpeed(r)*(this.has('speed')?1.25:1);
      const dx=r.targetX-r.playerX,dy=r.targetY-r.playerY;
      const distance=Math.hypot(dx,dy),step=Math.min(1,speed*dt/16.67/Math.max(1,distance));
      // Both axes belong to the player: no automatic depth tracking.
      r.playerX+=dx*step;r.playerY+=dy*step;
      const ball=r.ball;
      const returning=ball?.state===B.HIT?ball:null;
      // Input records bounded two-dimensional targets; no hidden teleportation.
      this.setInput(false,false,false,false,false);
      super.update(dt);
      if(returning&&!r.ball){
        const gap=Math.abs(returning.returnTargetX-r.opponentX);
        if(gap>38){r.winners++;r.smashes+=3;r.lastWinnerAt=r.elapsedMs;r.rallyCount=0;r.doubleBouncePhase=0;r.waitUntil=r.elapsedMs+650;}
        r.nextStartX=r.opponentX;
      }
      return this.getState();
    }
    has(key){const a=this.run.assist;return a?.key===key&&a.until>this.run.elapsedMs&&a.charges!==0;}
    _getAutoHitRange(r){return super._getAutoHitRange(r)*(this.has('giant')?1.35:this.has('multi')?1.25:1);}
    _spawnBall(r){
      super._spawnBall(r,Math.min(180,(r.level-1)*9));
      const b=r.ball;
      // Opening balls stay near the starting depth; later shots use the whole half-court.
      if(r.totalSpawned<=3){b.targetY=r.court.playerY*C.height+10;b.inKitchen=false;}
      // Original onboarding/serve retargeting must also rebuild its ballistic coefficients.
      const startX=r.nextStartX??b.startX;
      const slow=this.has('slow')?1.25:1;
      flight(b,'',startX,b.startY,b.targetX,b.targetY,clamp(b.travelMs,850,2200)*slow,b.arcHeight,30);
      b.x=startX;b.y=b.startY-30;b.groundY=b.startY;r.opponentX=startX;r.nextStartX=null;
      // Automatic play always waits for the bounce, including Kitchen balls.
      b.mustBounce=true;
    }
    _executeHit(r,b,timing){
      const active=r.assist;
      super._executeHit(r,b,timing);
      if(b.state!==B.HIT)return;
      r.stroke={at:r.elapsedMs,x:b.x,y:b.y,groundY:b.groundY};
      if(r.elapsedMs<r.rushUntil)r.smashes++;
      r.rushReturns++;
      if(r.rushReturns===5){r.rushUntil=r.elapsedMs+6000;r.rushReturns=0;}
      const offset=clamp((b.x-r.playerX)/Math.max(1,this._getAutoHitRange(r)),-1,1);
      let aim=clamp(C.width/2+offset*C.width*.60,48,C.width-48);
      if(this.has('storm'))aim=r.opponentX<C.width/2?C.width-48:48;
      const factor=this.has('bomb')?.7:this.has('fire')?.8:1;
      flight(b,'return',b.x,b.groundY,aim,r.court.opponentY*C.height,b.returnTravelMs*factor,b.returnArcHeight,Math.max(0,b.groundY-b.y));
      if(active?.charges>0&&['storm','fire','bomb','multi'].includes(active.key)){active.charges--;if(!active.charges)r.assist=null;}
      if(r.totalSmashed>=r.nextPowerAt){this.grantPlayer();r.nextPowerAt+=6;}
    }
    _loseLife(r){
      if(this.has('shield')){r.assist=null;r.savedAt=r.elapsedMs;return;}
      r.rushReturns=0;r.rushUntil=0;super._loseLife(r);
    }
    grantPlayer(){
      const r=this.run;
      if(!r.playerQueue.length){
        r.playerQueue=C.roster(r.edition).slice();
        for(let i=r.playerQueue.length-1;i>0;i--){const j=Math.floor(r.rng()*(i+1));[r.playerQueue[i],r.playerQueue[j]]=[r.playerQueue[j],r.playerQueue[i]];}
        if(r.playerQueue[0].id===r.lastPlayer)[r.playerQueue[0],r.playerQueue[1]]=[r.playerQueue[1],r.playerQueue[0]];
      }
      const player=r.playerQueue.shift(),power=C.powers[player.power];r.lastPlayer=player.id;
      r.assist=power.seconds?{key:player.power,until:r.elapsedMs+power.seconds*1000,charges:power.charges??-1}:null;
      if(player.power==='life'){if(r.lives<3)r.lives++;else r.smashes+=2;}
      r.powerEvent={player:player.id,power:player.power,serial:++r.powerSerial,at:r.elapsedMs};
      return r.powerEvent;
    }
    getState(){const state=super.getState(),r=this.run;if(!r)return state;return {...state,level:r.level||1,winners:r.winners||0,rushUntil:r.rushUntil||0,rushReturns:r.rushReturns||0,assist:r.assist?{...r.assist}:null,powerEvent:r.powerEvent?{...r.powerEvent}:null,lastWinnerAt:r.lastWinnerAt,savedAt:r.savedAt,stroke:r.stroke?{...r.stroke}:null,hitRange:this._getAutoHitRange(r)};}
  }
  window.KR_RallyEngine=RallyEngine;
})();
