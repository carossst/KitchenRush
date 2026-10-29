/* Native, one-finger UI. No payment gate and no secrets in the browser. */
(() => {
  'use strict';
  const C=window.KR_RALLY,V=window.KR_RALLY_VIEW,$=id=>document.getElementById(id);
  const edition=new URLSearchParams(location.search).get('edition')==='us'?'us':'fr',lang=edition==='fr'?'fr':'en';
  const copy={
    fr:{eyebrow:'LE PICKLEBALL, VERSION ARCADE',headline:'Un échange de plus.',intro:'Place-toi, laisse rebondir et renvoie. Trouve le bon angle pour déborder ton adversaire.',controls:'Glisse à gauche ou à droite ; souris ou flèches sur ordinateur. Renvoi automatique. Décale-toi du cercle pour viser un côté.',scoring:'Un renvoi : +1. Un coup gagnant : +3 en plus. Nouveau niveau tous les 8 renvois.',play:'Entrer sur le terrain →',players:'Les 10 joueurs et leurs pouvoirs',fiction:'Effets arcade fictifs inspirés de vrais coups. Aucune affiliation officielle avec les joueurs cités.',score:'SCORE',level:'NIVEAU',lives:'VIES',splash:'Lis le rebond. Trouve ton angle.',world:'UN TERRAIN, TOUS LES JOUEURS',ranking:'Le classement',refresh:'Actualiser',nickname:'Ton pseudo public (20 caractères maximum)',save:'Publier mon score',newsletter:'Recevoir les nouvelles de Kitchen Rush',email:'Ton adresse email',consent:'Je souhaite recevoir les nouvelles du jeu. Je confirme mon inscription par email et peux me désinscrire à tout moment.',subscribe:'Recevoir le mail de confirmation',metrics:'J’accepte les statistiques anonymes de jeu via GoatCounter.',privacy:'Confidentialité',terms:'Conditions',newPower:'NOUVEAU POUVOIR',pausedHint:'La partie et la durée du pouvoir sont en pause. Lis tranquillement.',continue:'Compris, on reprend →',finished:'FIN DE PARTIE',again:'Encore un échange →',seeRanking:'Voir le classement',waiting:'Renvoie 4 balles pour rencontrer ton premier joueur.',loading:'Connexion au classement…',online:'Classement mondial disponible · scores vérifiés par relecture de la partie.',offline:'Mode entraînement. Le serveur de classement n’est pas connecté ; ton record reste sur cet appareil.',empty:'Aucun score publié pour ce nouveau mode. À toi de jouer !',paused:'En pause · appuie sur Reprendre ou P.',resume:'Reprendre',pause:'Pause',winner:'Coup gagnant ! +3',lost:'Balle ratée : une vie en moins. Replace-toi sur le cercle.',saved:'Dig : une balle sauvée !',ended:'renvois · {w} coups gagnants · record sur cet appareil : {best}',saving:'Vérification de la partie…',savedScore:'Score publié !',failed:'Envoi impossible. Tu peux réessayer.',sending:'Envoi en cours…',subscribed:'Vérifie ta boîte mail pour confirmer ton inscription.',signupError:'Inscription indisponible. Réessaie plus tard.',full:'Vies pleines : +2 points',practice:'Entraînement · score conservé sur cet appareil',seconds:'s',charges:'renvoi(s)',max:'Partie terminée après 10 minutes. Bravo !'},
    en:{eyebrow:'PICKLEBALL GOES ARCADE',headline:'One more rally.',intro:'Move, let it bounce, return. Find your angle and make your opponent run.',controls:'Slide left or right; mouse or arrows on desktop. Automatic returns. Stand off-centre from the circle to aim to a side.',scoring:'Return: +1. Winner: +3 extra. A new level every 8 returns.',play:'Step onto the court →',players:'The 10 players and their powers',fiction:'Fictional arcade effects named after real strokes. No official affiliation with the named players.',score:'SCORE',level:'LEVEL',lives:'LIVES',splash:'Read the bounce. Find your angle.',world:'ONE COURT, EVERYONE PLAYS',ranking:'The leaderboard',refresh:'Refresh',nickname:'Your public nickname (20 characters maximum)',save:'Publish my score',newsletter:'Get Kitchen Rush updates',email:'Your email address',consent:'I want game updates. I will confirm by email and can unsubscribe at any time.',subscribe:'Send my confirmation email',metrics:'I agree to anonymous game statistics through GoatCounter.',privacy:'Privacy',terms:'Terms',newPower:'NEW POWER',pausedHint:'The game and power timer are paused. Take your time.',continue:'Got it, keep playing →',finished:'GAME OVER',again:'One more rally →',seeRanking:'See leaderboard',waiting:'Return 4 balls to meet your first player.',loading:'Connecting to the leaderboard…',online:'World leaderboard available · scores checked by replaying the game.',offline:'Practice mode. The leaderboard server is not connected; your record stays on this device.',empty:'No scores in this new mode yet. Your turn!',paused:'Paused · press Resume or P.',resume:'Resume',pause:'Pause',winner:'Winner! +3',lost:'Missed ball: one life lost. Move towards the circle.',saved:'Dig: one ball saved!',ended:'returns · {w} winners · best on this device: {best}',saving:'Checking your game…',savedScore:'Score published!',failed:'Could not send. You can retry.',sending:'Sending…',subscribed:'Check your inbox to confirm your subscription.',signupError:'Signup unavailable. Please try again later.',full:'Full lives: +2 points',practice:'Practice · record saved on this device',seconds:'s',charges:'return(s)',max:'Game completed after 10 minutes. Well played!'}
  }[lang];
  document.documentElement.lang=lang;
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=copy[el.dataset.i18n];
  for(const a of document.querySelectorAll('.edition a'))if(a.href.endsWith('edition='+edition))a.setAttribute('aria-current','page');
  $('court').setAttribute('aria-label',copy.controls);
  const store={get(key,fallback){try{return JSON.parse(localStorage.getItem('kr-rally:'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('kr-rally:'+key,JSON.stringify(value));}catch{/* Private browsing remains playable. */}}};
  const configuredApi=document.querySelector('meta[name="kr-api-base"]')?.content.trim();
  const apiBase=configuredApi?new URL(configuredApi).href.replace(/\/?$/,'/'):new URL('.',location.href).pathname; // Works under /KitchenRush/ on GitHub Pages.
  async function api(path,body){const response=await fetch(apiBase+'api/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000),credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('api');return response.json();}
  function track(name){if(!store.get('metrics',false)||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||!['carossst.github.io','kitchenrush.app'].includes(location.hostname))return;const p=new URLSearchParams({p:name+'-rally-'+edition,t:'Kitchen Rush Rally',e:'true',ns:'true',r:'',rnd:String(Math.random()).slice(2)});void fetch('https://kitchenrush.goatcounter.com/count?'+p,{mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true}).catch(()=>{});}
  $('metrics').checked=store.get('metrics',false);$('metrics').onchange=()=>store.set('metrics',$('metrics').checked);
  for(const player of C.roster(edition)){const article=document.createElement('article'),name=document.createElement('strong'),effect=document.createElement('span');name.textContent=player.name+' · '+C.powers[player.power][lang][0];effect.textContent=C.powers[player.power][lang][1];article.append(name,effect);$('roster').append(article);}
  let engine=new window.KR_RallyEngine(),state=engine.start({edition}),playing=false,paused=false,starting=false,session=null,completed=null,ticks=0,inputs=[],lastTarget=null,target=C.width/2,acc=0,last=0,powerSerial=0,seen=store.get('seen',[]),keys={left:false,right:false};
  const seenSet=new Set(Array.isArray(seen)?seen:[]);let feedbackUntil=0;
  function say(text){$('feedback').textContent=text;feedbackUntil=performance.now()+3500;}
  function modalOpen(){return !!document.querySelector('dialog[open]');}
  function setPaused(value){paused=value;keys={left:false,right:false};acc=0;last=performance.now();$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?copy.resume:copy.pause);if(value)say(copy.paused);}
  async function start(){
    if(starting)return;starting=true;playing=false;setPaused(true);$('start').disabled=true;$('pause').disabled=true;
    try{
      for(const d of document.querySelectorAll('dialog[open]'))d.close();
      session=null;completed=null;let seed=crypto.getRandomValues(new Uint32Array(1))[0];
      try{const data=await api('runs',{edition,version:C.version});if(data.version!==C.version)throw Error('version');session=data;seed=data.seed;$('connection').textContent=copy.online;}catch{$('connection').textContent=copy.offline;}
      engine=new window.KR_RallyEngine();state=engine.start({edition,seed});ticks=0;inputs=[];lastTarget=null;target=C.width/2;acc=0;last=performance.now();powerSerial=0;playing=true;document.body.classList.add('playing');setPaused(false);$('splash').hidden=true;$('pause').disabled=false;$('submit-score').hidden=true;$('start').textContent=copy.again;say(copy.waiting);track('start');$('court').focus({preventScroll:true});
    }finally{starting=false;$('start').disabled=false;}
  }
  function powerNotice(event){
    if(!event||event.serial===powerSerial)return;powerSerial=event.serial;
    const player=C.roster(edition).find(p=>p.id===event.player),power=C.powers[event.power];
    $('power-name').textContent=player.name+' · '+power[lang][0];$('power-effect').textContent=power[lang][1];track('power_'+event.power);
    if(!seenSet.has(event.power)){
      setPaused(true);$('effect-title').textContent=player.name+' · '+power[lang][0];$('effect-copy').textContent=power[lang][1];$('effect-dialog').showModal();
      $('effect-close').onclick=()=>{seenSet.add(event.power);store.set('seen',[...seenSet]);$('effect-dialog').close();setPaused(false);};
    }
  }
  function finish(){
    playing=false;document.body.classList.remove('playing');$('pause').disabled=true;completed=session?{...session,ticks,inputs:inputs.map(row=>row.slice())}:null;
    const best=Math.max(store.get('best:'+edition,0),state.smashes);store.set('best:'+edition,best);
    $('result-score').textContent=state.smashes+' '+(lang==='fr'?'points':'points');$('result-copy').textContent=state.totalSmashed+' '+copy.ended.replace('{w}',state.winners).replace('{best}',best);$('result-dialog').showModal();$('submit-score').hidden=!completed;track('end');
    void api('newsletter').then(data=>{$('newsletter').hidden=data.enabled!==true;}).catch(()=>{});
  }
  function frame(now){
    const delta=last?Math.min(250,now-last):0;last=now;
    if(playing&&!paused&&!modalOpen()){
      acc+=delta;
      while(acc>=C.tickMs&&playing&&!paused){
        if(keys.left!==keys.right)target=Math.max(20,Math.min(C.width-20,target+(keys.right?1:-1)*6.5));
        const x=Math.round(target*10)/10;
        if(x!==lastTarget){inputs.push([ticks,x]);lastTarget=x;}
        const before=state;engine.setTarget(x);state=engine.update(C.tickMs);ticks++;acc-=C.tickMs;
        if(state.lives<before.lives)say(copy.lost);else if(state.savedAt!==before.savedAt)say(copy.saved);
        if(state.winners>before.winners)say(copy.winner);
        powerNotice(state.powerEvent);
        if(ticks>=C.maxTicks&&!state.done){engine.run.done=true;engine.run.endReason='TIME';state=engine.getState();}
        if(state.done)finish();
      }
    }else acc=0;
    V.draw($('court'),state,lang);$('rush').textContent=state.rushUntil>state.elapsedMs?(lang==='fr'?'RUSH · +2 par renvoi · ':'RUSH · +2 per return · ')+Math.ceil((state.rushUntil-state.elapsedMs)/1000)+' s':(lang==='fr'?'RUSH : ':'RUSH: ')+state.rushReturns+'/5 · '+(lang==='fr'?'5 renvois sans rater → +2 par renvoi pendant 6 s':'5 returns without a miss → +2 per return for 6 s');$('score').textContent=state.smashes;$('level').textContent=state.level;$('lives').textContent='♥ '.repeat(state.lives)+'♡ '.repeat(3-state.lives);$('lives').setAttribute('aria-label',copy.lives+' '+state.lives+'/3');
    const assist=state.assist;$('power-progress').value=assist?Math.max(0,(assist.until-state.elapsedMs)/(C.powers[assist.key].seconds*1000)):0;
    if(assist){$('power-effect').textContent=C.powers[assist.key][lang][1]+' · '+Math.ceil((assist.until-state.elapsedMs)/1000)+' '+copy.seconds+(assist.charges>0?' · '+assist.charges+' '+copy.charges:'');}else if(powerSerial&&state.elapsedMs-(state.powerEvent?.at||0)<3500){$('power-effect').textContent=C.powers[state.powerEvent.power][lang][1];}else if(powerSerial){$('power-effect').textContent=lang==='fr'?'Pouvoir terminé. Prochain joueur dans '+Math.max(0,engine.run.nextPowerAt-state.totalSmashed)+' renvois.':'Power ended. Next player in '+Math.max(0,engine.run.nextPowerAt-state.totalSmashed)+' returns.';}
    if(performance.now()>feedbackUntil)$('feedback').textContent='';
    requestAnimationFrame(frame);
  }
  let pointer=null;
  function move(e){target=Math.max(0,Math.min(C.width,V.pointerX($('court'),e.clientX,state.playerY)));}
  $('court').addEventListener('pointerdown',e=>{if(!playing||paused||pointer!==null)return;pointer=e.pointerId;$('court').setPointerCapture(pointer);move(e);});
  $('court').addEventListener('pointermove',e=>{if(playing&&!paused&&(e.pointerType==='mouse'||e.pointerId===pointer))move(e);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('court').addEventListener(name,()=>{pointer=null;});
  window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||modalOpen())return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(playing){e.preventDefault();keys[e.key==='ArrowLeft'?'left':'right']=true;}}if(e.key.toLowerCase()==='p'&&playing){e.preventDefault();setPaused(!paused);}if(e.code==='Space'&&!playing){e.preventDefault();void start();}});
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;});
  window.addEventListener('blur',()=>{if(playing)setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)setPaused(true);});
  $('pause').onclick=()=>setPaused(!paused);$('start').onclick=()=>void start();$('again').onclick=()=>void start();$('result-close').onclick=()=>{$('result-dialog').close();$('submit-score').scrollIntoView({block:'center',behavior:'smooth'});};
  $('effect-dialog').addEventListener('cancel',e=>e.preventDefault());
  async function ranking(){
    $('ranking-status').textContent=copy.loading;
    try{const data=await api('leaderboard?edition='+edition+'&version='+C.version);$('ranking').replaceChildren();for(const row of data.entries){const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=row.name;score.textContent=row.score;li.append(name,score);$('ranking').append(li);}$('ranking-status').textContent=data.entries.length?copy.online:copy.empty;}catch{$('ranking-status').textContent=copy.offline;}
  }
  $('refresh').onclick=()=>void ranking();
  $('submit-score').onsubmit=async e=>{e.preventDefault();if(!completed)return;const btn=e.currentTarget.querySelector('button');btn.disabled=true;$('submit-status').textContent=copy.saving;try{await api('scores',{...completed,name:$('nickname').value});completed=null;$('submit-status').textContent=copy.savedScore;track('score_submit');void ranking();}catch{$('submit-status').textContent=copy.failed;}finally{btn.disabled=false;}};
  $('signup').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;$('signup-status').textContent=copy.sending;try{await api('newsletter',{edition,email:$('email').value,consent:$('email-consent').checked,website:$('website').value});$('email').value='';$('email-consent').checked=false;$('signup-status').textContent=copy.subscribed;track('newsletter_accepted');}catch{$('signup-status').textContent=copy.signupError;}finally{btn.disabled=false;}};
  $('power-name').textContent=lang==='fr'?'À toi de jouer.':'Your court.';$('power-effect').textContent=copy.waiting;$('connection').textContent=copy.practice;
  // Replace only the legacy app worker within this exact repository scope.
  if('serviceWorker' in navigator)void navigator.serviceWorker.register('./sw.js?v=rally-1').catch(()=>{});
  if(['localhost','127.0.0.1'].includes(location.hostname))window.KR_RALLY_DEBUG={get state(){return state;},get engine(){return engine;},get paused(){return paused;}};
  void ranking();requestAnimationFrame(frame);
})();
