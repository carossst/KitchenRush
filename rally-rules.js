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
    start({seed=1,edition='fr',side='left',strategy='build',role='creator',style='arcade',precision=false}={}){
      if(!['arcade','advanced'].includes(style)||typeof precision!=='boolean'||!['left','right'].includes(side)||!Object.hasOwn(C.strategies,strategy)||!['support','creator'].includes(role))throw Error('setup');
      super.start({config:C.config,canvasW:C.width,canvasH:C.height,mode:'RUN',isDaily:false});
      const r=this.run;r.style=style;r.precision=precision;r.opponentStroke=null;r.capturedRound=0;r.captureUntil=0;r.rng=C.random(seed);r.edition=edition;r.side=side;r.strategy=strategy;r.role=role;r.level=1;r.winners=0;r.assist=null;r.powerEvent=null;r.powerSerial=0;r.rushUntil=0;r.rushReturns=0;r.nextPowerAt=4;r.playerQueue=[];r.lastPlayer=null;r.playerX=C.width*(side==='left'?.25:.75);r.targetX=r.playerX;r.partnerX=C.width*(side==='left'?.75:.25);r.partnerY=r.playerY;r.partnerStroke=null;r.opponentX=C.width*.3;r.opponentPartnerX=C.width*.7;r.opponentY=r.court.opponentY*C.height;r.opponentPartnerY=r.opponentY;r.receiver=null;r.hitter=null;r.serverSide=0;r.targetY=r.playerY;r.stroke=null;r.nextStartX=null;r.lastWinnerAt=-9999;
      return this.getState();
    }
    setTarget(x,y=this.run.targetY){
      const r=this.run;
      r.targetX=clamp(Number(x)||0,20,C.width-20);
      r.targetY=r.style==='advanced'?clamp(Number.isFinite(y)?y:r.targetY,r.playerMinY,r.playerMaxY):r.court.playerY*C.height;
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
      if(ball?.state==='HELD'){ball.x=r.playerX;ball.y=r.playerY-28;ball.targetY=r.playerY;ball.groundY=r.playerY;}
      this._moveTeams(r,dt);
      const returning=ball?.state===B.HIT?ball:null;
      // Input records bounded two-dimensional targets; no hidden teleportation.
      this.setInput(false,false,false,false,false);
      super.update(dt);
      if(r.ball?.state==='HELD'&&r.elapsedMs>=r.captureUntil){r.ball.state=B.BOUNCED;r.ball.captureReleased=true;this._executeHit(r,r.ball,0);}
      if(returning&&!r.ball){
        const leftGap=Math.hypot(returning.returnTargetX-r.opponentX,returning.returnTargetY-r.opponentY),rightGap=Math.hypot(returning.returnTargetX-r.opponentPartnerX,returning.returnTargetY-r.opponentPartnerY);
        const gap=Math.min(leftGap,rightGap);
        if(gap>38){r.winners++;r.smashes+=3;r.lastWinnerAt=r.elapsedMs;r.rallyCount=0;r.doubleBouncePhase=0;r.waitUntil=r.elapsedMs+650;}
        r.serverSide=leftGap<=rightGap?0:1;r.nextStartX=r.serverSide===0?r.opponentX:r.opponentPartnerX;
        if(gap<=38){
          const x=returning.returnTargetX,y=returning.returnTargetY,id=returning.id;
          this._spawnBall(r);
          const next=r.ball;Object.keys(returning).forEach(key=>delete returning[key]);Object.assign(returning,next,{id});r.ball=returning;
          flight(returning,'',x,y,next.targetX,next.targetY,next.travelMs,next.arcHeight,0);
          Object.assign(returning,{x,y,groundX:x,groundY:y,isServe:false});
          r.opponentStroke={at:r.elapsedMs,x,y,groundY:y,side:r.serverSide};r.waitUntil=0;
        }
      }
      return this.getState();
    }
    _partnerOwns(r,x){
      if(Math.abs(x-C.width/2)<=44)return r.role==='support';
      return r.side==='left'?x>C.width/2:x<C.width/2;
    }
    _moveTeams(r,dt){
      const b=r.ball,incoming=b&&['TRAVELING','LANDED','BOUNCED'].includes(b.state);
      const coversRight=r.side==='left';
      const ownSide=incoming&&this._partnerOwns(r,b.targetX);
      const attackingPartner=r.role==='support';
      const partnerTargetX=ownSide?clamp(b.targetX,coversRight?(attackingPartner?196:250):30,coversRight?450:(attackingPartner?284:230)):(coversRight?(attackingPartner?310:360):(attackingPartner?170:120));
      const coverY=r.strategy==='build'?Math.min(r.court.playerY*C.height,Math.max(r.court.kitchenLineY*C.height+24,r.playerY+20)):r.court.playerY*C.height;
      const readyY=attackingPartner?r.court.kitchenLineY*C.height+32:coverY;
      const partnerTargetY=ownSide?clamp(b.targetY,r.playerMinY,r.playerMaxY):readyY;
      const dx=partnerTargetX-r.partnerX,dy=partnerTargetY-r.partnerY;
      const fraction=Math.min(1,3.9*(this.has('speed')?1.25:1)*dt/16.67/Math.max(1,Math.hypot(dx,dy)));
      r.partnerX+=dx*fraction;r.partnerY+=dy*fraction;
      const chasing=b?.state===B.HIT&&r.elapsedMs>=r.opponentReactAt;
      const step=(1.25+Math.min(1.6,(r.level-1)*.10))*dt/16.67;
      for(const side of [0,1]){
        const key=side===0?'opponentX':'opponentPartnerX';
        const formation=C.rounds[(r.level-1)%C.rounds.length].formation;
        const target=chasing&&r.receiver===side?b.returnTargetX:formation[side];
        const yKey=side===0?'opponentY':'opponentPartnerY';
        const yTarget=chasing&&r.receiver===side?b.returnTargetY:r.court.opponentY*C.height;
        const dx=target-r[key],dy=yTarget-r[yKey],f=Math.min(1,step/Math.max(1,Math.hypot(dx,dy)));
        r[key]+=dx*f;r[yKey]+=dy*f;
      }
    }
    _tryPartnerHit(r,b){
      if(r.elapsedMs-b.bouncedAt<180)return;
      const partnerSide=this._partnerOwns(r,b.targetX);
      const takesMiddle=r.role==='support'&&Math.abs(b.targetX-C.width/2)<=44;
      const playerDistance=Math.hypot(r.playerX-b.x,r.playerY-28-b.y);
      const partnerDistance=Math.hypot(r.partnerX-b.x,r.partnerY-28-b.y);
      if(!partnerSide||(!takesMiddle&&playerDistance<=this._getAutoHitRange(r))||partnerDistance>46*(r.precision?.72:1)*(this.has('giant')?1.35:this.has('multi')?1.25:1))return;
      r.hitter='partner';try{b.autoHitFired=true;this._executeHit(r,b,0);}finally{r.hitter=null;}
    }
    has(key){const a=this.run.assist;return a?.key===key&&a.until>this.run.elapsedMs&&a.charges!==0;}
    _getAutoHitRange(r){return super._getAutoHitRange(r)*(r.precision?.72:1)*(this.has('giant')?1.35:this.has('multi')?1.25:1);}
    _spawnBall(r){
      const leftX=r.opponentX,rightX=r.opponentPartnerX;
      super._spawnBall(r,Math.min(180,(r.level-1)*9));
      r.opponentX=leftX;r.opponentPartnerX=rightX;
      const b=r.ball;
      // Every incoming ball reaches the same reception lane: horizontal play is enough.
      if(r.style==='arcade')b.targetY=r.court.playerY*C.height+10;b.inKitchen=b.targetY<r.court.kitchenLineY*C.height;
      b.bounceVx=0;b.bounceVy=0;
      // Original onboarding/serve retargeting must also rebuild its ballistic coefficients.
      const startX=r.serverSide===0?r.opponentX:r.opponentPartnerX;
      const rhythm=(r.level-1)%C.rounds.length===3?(r.totalSpawned%2?1.18:.88):1;
      const slow=(this.has('slow')?1.25:1)*C.strategies[r.strategy].counterSpeed*rhythm;
      b.startY=r.serverSide===0?r.opponentY:r.opponentPartnerY;
      flight(b,'',startX,b.startY,b.targetX,b.targetY,clamp(b.travelMs,850,2200)*slow,b.arcHeight,30);
      b.x=startX;b.y=b.startY-30;b.groundY=b.startY;r.nextStartX=null;
      // Automatic play always waits for the bounce, including Kitchen balls.
      b.mustBounce=true;
    }
    aimAt(ballX,playerX=this.run.playerX){
      const offset=clamp((ballX-playerX)/Math.max(1,this._getAutoHitRange(this.run)),-1,1);
      if(this.has('storm'))return this.run.opponentX<C.width/2?C.width-48:48;
      return clamp(C.width/2+offset*C.width*.60,48,C.width-48);
    }
    _executeHit(r,b,timing){
      // A short, automatic capture is a round bonus, never a reassigned player power.
      if(!r.hitter&&r.level%3===0&&r.capturedRound!==r.level&&!b.captureReleased){
        r.capturedRound=r.level;r.captureUntil=r.elapsedMs+1800;b.state='HELD';b.autoHitFired=true;return;
      }
      const active=r.assist;
      super._executeHit(r,b,timing);
      if(b.state!==B.HIT)return;
      r.level=Math.min(30,1+Math.floor(r.totalSmashed/8));
      const stroke={at:r.elapsedMs,x:b.x,y:b.y,groundY:b.groundY};
      if(r.hitter==='partner')r.partnerStroke={...stroke,middle:Math.abs(b.targetX-C.width/2)<=44};else r.stroke=stroke;
      if(r.precision)r.smashes++;
      if(r.elapsedMs<r.rushUntil)r.smashes++;
      r.rushReturns++;
      if(r.rushReturns===5){r.rushUntil=r.elapsedMs+6000;r.rushReturns=0;}
      const aim=this.aimAt(b.x,r.hitter==='partner'?r.partnerX:r.playerX);
      r.receiver=Math.abs(aim-r.opponentX)<=Math.abs(aim-r.opponentPartnerX)?0:1;r.opponentReactAt=r.elapsedMs+Math.max(120,320-(r.level-1)*12);
      const factor=this.has('bomb')?.7:this.has('fire')?.8:1;
      const plan=C.strategies[r.strategy];
      const targetY=r.strategy==='build'?r.court.netY*C.height-48:r.court.opponentY*C.height-30;
      flight(b,'return',b.x,b.groundY,aim,targetY,b.returnTravelMs*factor*plan.returnSpeed,b.returnArcHeight*plan.arc,Math.max(0,b.groundY-b.y));
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
      const unlock={giant:1,slow:1,multi:1,life:2,shield:2,speed:3,fire:3,storm:4,bomb:4};
      let eligible=r.playerQueue.findIndex(p=>(unlock[p.power]||1)<=r.level&&p.id!==r.lastPlayer);
      if(eligible<0)eligible=r.playerQueue.findIndex(p=>(unlock[p.power]||1)<=r.level);
      // Keep locked players in the bag; newly eligible identities are not lost.
      if(eligible<0){r.playerQueue=[];return this.grantPlayer();}
      const [player]=r.playerQueue.splice(eligible,1),power=C.powers[player.power];r.lastPlayer=player.id;
      r.assist=power.seconds?{key:player.power,until:r.elapsedMs+power.seconds*1000,charges:power.charges??-1}:null;
      if(player.power==='life'){if(r.lives<3)r.lives++;else r.smashes+=2;}
      r.powerEvent={player:player.id,power:player.power,serial:++r.powerSerial,at:r.elapsedMs};
      return r.powerEvent;
    }
    getState(){const state=super.getState(),r=this.run;if(!r)return state;return {...state,style:r.style||'arcade',precision:!!r.precision,captureReady:r.level%3===0&&r.capturedRound!==r.level,captureUntil:r.captureUntil||0,opponentStroke:r.opponentStroke?{...r.opponentStroke}:null,roundProfile:(r.level-1)%C.rounds.length,aimX:r.ball?this.aimAt(r.ball.state===B.HIT?r.ball.x:r.ball.targetX):null,level:r.level||1,winners:r.winners||0,rushUntil:r.rushUntil||0,rushReturns:r.rushReturns||0,assist:r.assist?{...r.assist}:null,powerEvent:r.powerEvent?{...r.powerEvent}:null,lastWinnerAt:r.lastWinnerAt,savedAt:r.savedAt,stroke:r.stroke?{...r.stroke}:null,hitRange:this._getAutoHitRange(r),partnerX:r.partnerX??C.width*.75,partnerY:r.partnerY??r.playerY,partnerStroke:r.partnerStroke?{...r.partnerStroke}:null,opponentPartnerX:r.opponentPartnerX??C.width*.7,serverSide:r.serverSide||0,side:r.side||'left',strategy:r.strategy||'build',role:r.role||'creator',opponentY:r.opponentY??r.court.opponentY*C.height,opponentPartnerY:r.opponentPartnerY??r.court.opponentY*C.height};}
  }
  window.KR_RallyEngine=RallyEngine;
})();
