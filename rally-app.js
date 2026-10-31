/* Native, one-finger UI. No payment gate and no secrets in the browser. */
(() => {
  'use strict';
  const C=window.KR_RALLY,V=window.KR_RALLY_VIEW,$=id=>document.getElementById(id);
  const edition=new URLSearchParams(location.search).get('edition')==='us'?'us':'fr',lang=edition==='fr'?'fr':'en';
  const copy={
    fr:{eyebrow:'LE PICKLEBALL, VERSION ARCADE',headline:'Trouve l’angle. Bats la défense.',intro:'Déplace-toi, renvoie et vise les espaces entre les deux adversaires. Ton partenaire couvre l’autre côté.',controls:'Glisse à gauche ou à droite, ou utilise ← →. La frappe est automatique : touche la balle sur le côté de ta raquette pour viser de ce côté.',scoring:'Un renvoi : +1. Un coup gagnant : +3 en plus. Nouveau niveau tous les 8 renvois.',play:'Entrer sur le terrain →',players:'Les 10 joueurs et leurs pouvoirs',fiction:'Effets arcade fictifs inspirés de vrais coups. Aucune affiliation officielle avec les joueurs cités.',score:'SCORE',level:'NIVEAU',lives:'VIES',splash:'Lis le rebond. Trouve ton angle.',world:'UN TERRAIN, TOUS LES JOUEURS',ranking:'Le classement',refresh:'Actualiser',nickname:'Ton pseudo public (20 caractères maximum)',save:'Publier mon score',newsletter:'Recevoir les nouvelles de Kitchen Rush',email:'Ton adresse email',consent:'Je souhaite recevoir les nouvelles du jeu. Je confirme mon inscription par email et peux me désinscrire à tout moment.',subscribe:'Recevoir le mail de confirmation',metrics:'J’accepte les statistiques anonymes de jeu via GoatCounter.',privacy:'Confidentialité',terms:'Conditions',newPower:'NOUVEAU POUVOIR',pausedHint:'En pause. Reprends quand tu es prêt.',continue:'Compris, on reprend →',finished:'FIN DE PARTIE',again:'Encore un échange →',seeRanking:'Voir le classement',waiting:'Renvoie 4 balles pour rencontrer ton premier joueur.',loading:'Connexion au classement…',online:'Classement mondial disponible · scores vérifiés par relecture de la partie.',offline:'Mode entraînement. Le serveur de classement n’est pas connecté ; ton record reste sur cet appareil.',empty:'Aucun score publié pour ce nouveau mode. À toi de jouer !',paused:'En pause · appuie sur Reprendre ou P.',resume:'Reprendre',pause:'Pause',winner:'Coup gagnant ! +3',lost:'Balle ratée : une vie en moins. Replace-toi sur le cercle.',saved:'Dig : une balle sauvée !',ended:'renvois · {w} coups gagnants · record sur cet appareil : {best}',saving:'Vérification de la partie…',savedScore:'Score publié !',failed:'Envoi impossible. Tu peux réessayer.',sending:'Envoi en cours…',subscribed:'Vérifie ta boîte mail pour confirmer ton inscription.',signupError:'Inscription indisponible. Réessaie plus tard.',full:'Vies pleines : +2 points',practice:'Entraînement · score conservé sur cet appareil',seconds:'s',charges:'renvoi(s)',max:'Partie terminée après 10 minutes. Bravo !'},
    en:{eyebrow:'PICKLEBALL GOES ARCADE',headline:'Find the angle. Beat the defence.',intro:'Move, return and aim for the gaps between two opponents. Your partner covers the other side.',controls:'Slide left or right, or use ← →. Returns are automatic: hit off-centre to aim towards that side.',scoring:'Return: +1. Winner: +3 extra. A new level every 8 returns.',play:'Step onto the court →',players:'The 10 players and their powers',fiction:'Fictional arcade effects named after real strokes. No official affiliation with the named players.',score:'SCORE',level:'LEVEL',lives:'LIVES',splash:'Read the bounce. Find your angle.',world:'ONE COURT, EVERYONE PLAYS',ranking:'The leaderboard',refresh:'Refresh',nickname:'Your public nickname (20 characters maximum)',save:'Publish my score',newsletter:'Get Kitchen Rush updates',email:'Your email address',consent:'I want game updates. I will confirm by email and can unsubscribe at any time.',subscribe:'Send my confirmation email',metrics:'I agree to anonymous game statistics through GoatCounter.',privacy:'Privacy',terms:'Terms',newPower:'NEW POWER',pausedHint:'Paused. Continue when you are ready.',continue:'Got it, keep playing →',finished:'GAME OVER',again:'One more rally →',seeRanking:'See leaderboard',waiting:'Return 4 balls to meet your first player.',loading:'Connecting to the leaderboard…',online:'World leaderboard available · scores checked by replaying the game.',offline:'Practice mode. The leaderboard server is not connected; your record stays on this device.',empty:'No scores in this new mode yet. Your turn!',paused:'Paused · press Resume or P.',resume:'Resume',pause:'Pause',winner:'Winner! +3',lost:'Missed ball: one life lost. Move towards the circle.',saved:'Dig: one ball saved!',ended:'returns · {w} winners · best on this device: {best}',saving:'Checking your game…',savedScore:'Score published!',failed:'Could not send. You can retry.',sending:'Sending…',subscribed:'Check your inbox to confirm your subscription.',signupError:'Signup unavailable. Please try again later.',full:'Full lives: +2 points',practice:'Practice · record saved on this device',seconds:'s',charges:'return(s)',max:'Game completed after 10 minutes. Well played!'}
  }[lang];
  Object.assign(copy,lang==='fr'?{
    tactics:'Options tactiques · facultatif',chooseSide:'1. Ton côté',leftSide:'À gauche',rightSide:'À droite',leftRole:'Ton partenaire couvre la droite.',rightRole:'Ton partenaire couvre la gauche.',chooseStrategy:'2. Tes renvois',buildTitle:'Doux · drops',buildBrief:'Balles douces près du filet. Ton partenaire accompagne ta montée.',driveTitle:'Rapides · drives',driveBrief:'Renvois rapides vers le fond. Les balles reviennent aussi plus vite.',strategySource:'Deux options arcade inspirées du passage de Noé Khlif sur les drives et les drops.'
  }:{tactics:'Tactical options · optional',chooseSide:'1. Your side',leftSide:'Left',rightSide:'Right',leftRole:'Your partner covers the right.',rightRole:'Your partner covers the left.',chooseStrategy:'2. Your returns',buildTitle:'Soft · drops',buildBrief:'Soft shots near the net. Your partner follows your approach.',driveTitle:'Fast · drives',driveBrief:'Fast returns to the back. Incoming shots are faster too.',strategySource:'Two arcade options inspired by Noé Khlif’s discussion of drives and drops.'});
  Object.assign(copy,lang==='fr'?{
    chooseRole:'3. Ton rôle',supportTitle:'Pilier · j’assure',supportBrief:'Tu es le pilier. Ton partenaire monte et prend les balles du milieu.',creatorTitle:'Créateur · j’attaque',creatorBrief:'Tu es le créateur. Tu prends le milieu ; ton partenaire couvre son côté.',roleSource:'Inspiré du duo raconté par Thomas Provost : un pilier patient et un partenaire qui crée les occasions.'
  }:{chooseRole:'3. Your role',supportTitle:'Anchor · I support',supportBrief:'You are the anchor. Your partner moves up and takes the middle.',creatorTitle:'Creator · I attack',creatorBrief:'You create chances and take the middle. Your partner covers their side.',roleSource:'Inspired by Thomas Provost’s account: a patient anchor and a partner creating chances.'});
  Object.assign(copy,lang==='fr'?{
    modeTitle:'Ta partie',classic:'Partie libre',daily:'Défi du jour',challengeTitle:'Défis facultatifs',advanced:'Mode avancé · profondeur au doigt et avec ↑ ↓. Les balles arrivent à plusieurs profondeurs.',precision:'Précision · zone de frappe réduite, +1 point par renvoi d’équipe. Classement séparé.',recent:'Tes cinq dernières parties',update:'Installer la mise à jour',share:'Partager mon résultat',copy:'Copier le résultat'
  }:{modeTitle:'Your game',classic:'Free play',daily:'Daily challenge',challengeTitle:'Optional challenges',advanced:'Advanced mode · move in depth with touch and ↑ ↓. Balls land at different depths.',precision:'Precision · smaller hitting zone, +1 point per team return. Separate leaderboard.',recent:'Your last five games',update:'Install update',share:'Share my result',copy:'Copy result'});
  if(['localhost','127.0.0.1'].includes(location.hostname)){copy.online=lang==='fr'?'Classement local de test · scores vérifiés.':'Local test leaderboard · verified scores.';copy.world=lang==='fr'?'CLASSEMENT LOCAL DE TEST':'LOCAL TEST LEADERBOARD';}
  document.documentElement.lang=lang;
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=copy[el.dataset.i18n];
  for(const a of document.querySelectorAll('.edition a'))if(a.href.endsWith('edition='+edition))a.setAttribute('aria-current','page');
  $('court').setAttribute('aria-label',copy.controls);
  const store={get(key,fallback){try{return JSON.parse(localStorage.getItem('kr-rally:'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('kr-rally:'+key,JSON.stringify(value));}catch{/* Private browsing remains playable. */}}};
  const configuredApi=document.querySelector('meta[name="kr-api-base"]')?.content.trim();
  const apiBase=configuredApi?new URL(configuredApi).href.replace(/\/?$/,'/'):new URL('.',location.href).pathname; // Works under /KitchenRush/ on GitHub Pages.
  async function api(path,body){if(!navigator.onLine)throw Error('offline');const response=await fetch(apiBase+'api/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000),credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('api');return response.json();}
  function track(name){if(!store.get('metrics',false)||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||!['carossst.github.io','kitchenrush.app'].includes(location.hostname))return;const p=new URLSearchParams({p:name+'-rally-'+edition,t:'Kitchen Rush Rally',e:'true',ns:'true',r:'',rnd:String(Math.random()).slice(2)});void fetch('https://kitchenrush.goatcounter.com/count?'+p,{mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true}).catch(()=>{});}
  const fx=window.KR_RALLY_FEEDBACK||{reset(){},observe(){}},sound=window.KR_RALLY_SOUND||{setEnabled(){},unlock(){},play(){}};
  let soundOn=store.get('sound',false)===true;
  function syncSound(){sound.setEnabled(soundOn);$('sound').textContent=(lang==='fr'?'SON':'SOUND')+(soundOn?' ✓':' ×');$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',lang==='fr'?(soundOn?'Couper le son':'Activer le son'):(soundOn?'Mute sound':'Enable sound'));}
  syncSound();$('sound').onclick=()=>{soundOn=!soundOn;store.set('sound',soundOn);syncSound();sound.unlock();};
  copy.level=lang==='fr'?'MANCHE':'ROUND';
  document.querySelector('[data-i18n="level"]').textContent=copy.level;
  $('metrics').checked=store.get('metrics',false);$('metrics').onchange=()=>store.set('metrics',$('metrics').checked);
  for(const player of C.roster(edition)){const article=document.createElement('article'),name=document.createElement('strong'),effect=document.createElement('span'),pair=document.createElement('span');name.textContent=player.name+' · '+player.effect[lang][0];effect.textContent=player.effect[lang][1];pair.textContent=player.id===player.equivalent.id?(lang==='fr'?'Même joueur et même pouvoir dans les deux éditions.':'Same player and power in both editions.'):(lang==='fr'?'Équivalent USA : ':'French counterpart: ')+player.equivalent.name+(lang==='fr'?' · pouvoir identique.':' · identical power.');article.append(name,effect,pair);$('roster').append(article);}
  const savedSetup=store.get('setup',{});
  $('side-'+(savedSetup.side==='right'?'right':'left')).checked=true;
  $('strategy-'+(savedSetup.strategy==='drive'?'drive':'build')).checked=true;
  $('role-'+(savedSetup.role==='support'?'support':'creator')).checked=true;
  const initialParams=new URLSearchParams(location.search);
  $('advanced').checked=initialParams.has('style')?initialParams.get('style')==='advanced':savedSetup.style==='advanced';$('precision').checked=initialParams.has('precision')?initialParams.get('precision')==='true':savedSetup.precision===true;
  $('game-mode').value=new URLSearchParams(location.search).get('mode')==='daily'?'daily':'classic';
  const utcDay=()=>new Date().toISOString().slice(0,10);
  function choices(){
    const mode=$('game-mode').value;
    if(mode==='daily')return {side:'left',strategy:'build',role:'creator',style:'arcade',precision:false,mode,day:utcDay()};
    return {side:document.querySelector('input[name=side]:checked').value,strategy:document.querySelector('input[name=strategy]:checked').value,role:document.querySelector('input[name=role]:checked').value,style:$('advanced').checked?'advanced':'arcade',precision:$('precision').checked,mode,day:''};
  }
  function lockSetup(value){for(const input of document.querySelectorAll('.setup input,.setup select'))input.disabled=value||($('game-mode').value==='daily'&&input.id!=='game-mode');}
  function modeNote(){const c=choices();if(c.mode==='daily'){$('side-left').checked=true;$('strategy-build').checked=true;$('role-creator').checked=true;$('advanced').checked=false;$('precision').checked=false;}const controls=c.style==='advanced'?(lang==='fr'?'Mode avancé : glisse dans toutes les directions ou utilise les quatre flèches. Renvoi automatique après rebond.':'Advanced mode: drag in any direction or use all four arrows. Returns are automatic after the bounce.'):copy.controls;document.querySelector('[data-i18n=controls]').textContent=controls;$('court').setAttribute('aria-label',controls);document.querySelector('[data-i18n=scoring]').textContent=lang==='fr'?'Renvoi : +'+(c.precision?2:1)+'. Coup gagnant : +3 en plus. Manche suivante après 8 renvois.':'Return: +'+(c.precision?2:1)+'. Winner: +3 extra. Next round after 8 returns.';$('mode-note').textContent=c.mode==='daily'?(lang==='fr'?'Même défi pour tous · '+c.day+' UTC · paramètres imposés. Essais illimités.':'Same challenge for everyone · '+c.day+' UTC · fixed settings. Unlimited attempts.'):(lang==='fr'?'Joue tout de suite. Les options tactiques sont facultatives.':'Play right away. Tactical options are optional.');}
  const progress=window.KR_RALLY_PROGRESS;
  let runSetup=null,result=null,waitingWorker=null,reloading=false;
  function renderProgress(){
    const data=progress.snapshot(),met=new Set(data.met),roster=C.roster(edition);
    $('collection-title').textContent=(lang==='fr'?'Joueurs rencontrés · ':'Players met · ')+roster.filter(p=>met.has(p.id)).length+'/10';
    $('collection-list').replaceChildren();for(const p of roster){const li=document.createElement('li');li.textContent=met.has(p.id)?p.name+' · '+p.effect[lang][0]:(lang==='fr'?'Joueur à découvrir':'Undiscovered player');li.className=met.has(p.id)?'met':'unknown';$('collection-list').append(li);}
    $('history-list').replaceChildren();for(const h of data.history.filter(h=>h.edition===edition).slice(-5).reverse()){
      const li=document.createElement('li');li.textContent=h.score+' pts · '+(lang==='fr'?'manche ':'round ')+h.level+' · '+(h.mode==='daily'?copy.daily+' '+h.day:copy.classic)+(h.style==='advanced'?(lang==='fr'?' · avancé':' · advanced'):'')+(h.precision?(lang==='fr'?' · précision':' · precision'):'');$('history-list').append(li);
    }
  }
  function syncUpdate(){if(!waitingWorker)return;$('update-game').hidden=false;$('update-game').disabled=playing||starting;$('update-note').textContent=playing||starting?(lang==='fr'?'Mise à jour prête. Disponible après cette partie.':'Update ready. Available after this game.'):(lang==='fr'?'Mise à jour prête. Ton historique sera conservé.':'Update ready. Your history will be kept.');}

  let engine=new window.KR_RallyEngine(),state=engine.start({edition,...choices()}),playing=false,paused=false,starting=false,session=null,completed=null,ticks=0,inputs=[],lastTarget=null,target=state.playerX,targetY=C.config.court.playerY*C.height,acc=0,last=0,powerSerial=0,seen=store.get('seen:visual-1',[]),keys={left:false,right:false,up:false,down:false};
  const seenSet=new Set(Array.isArray(seen)?seen:[]);let feedbackUntil=0;
  function say(text){$('feedback').textContent=text;feedbackUntil=performance.now()+3500;}
  function modalOpen(){return !!document.querySelector('dialog[open]');}
  function syncCourtAction(){
    const show=!playing||paused;
    $('splash').hidden=!show;
    $('court-action').textContent=playing?(lang==='fr'?'Reprendre ▶':'Resume ▶'):(lang==='fr'?'Jouer ▶':'Play ▶');
    $('court-message').textContent=playing?(lang==='fr'?'En pause':'Paused'):(lang==='fr'?'Prêt à jouer ?':'Ready for a rally?');
    $('court-hint').textContent=(runSetup||choices()).style==='advanced'?(lang==='fr'?'Glisse dans toutes les directions ou utilise les quatre flèches.':'Drag in any direction or use all four arrows.'):lang==='fr'?'Glisse à gauche/droite ou utilise ← →. Vise les espaces en face !':'Slide left/right or use ← →. Aim for the gaps ahead!' ;
  }
  function setPaused(value){paused=value;keys={left:false,right:false,up:false,down:false};acc=0;last=performance.now();$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?copy.resume:copy.pause);syncCourtAction();if(value)say(copy.paused);}
  $('court-action').onclick=()=>{if(playing){sound.unlock();setPaused(false);$('court').focus({preventScroll:true});}else void start();};

  async function start(){
    if(starting)return;sound.unlock();fx.reset();const setup=choices();runSetup={...setup};result=null;syncUpdate();store.set('setup',setup);lockSetup(true);starting=true;playing=false;setPaused(true);$('court-action').disabled=true;$('court-action').textContent=lang==='fr'?'Démarrage…':'Starting…';$('start').disabled=true;$('pause').disabled=true;
    try{
      for(const d of document.querySelectorAll('dialog[open]'))d.close();
      session=null;completed=null;let seed=setup.mode==='daily'?C.dailySeed(setup.day):crypto.getRandomValues(new Uint32Array(1))[0];
      try{const data=await api('runs',{edition,version:C.version,...setup});if(data.version!==C.version||data.side!==setup.side||data.strategy!==setup.strategy||data.role!==setup.role)throw Error('version');if(data.style!==setup.style||data.precision!==setup.precision||data.mode!==setup.mode)throw Error('setup');session=data;seed=data.seed;setup.day=data.day;runSetup={...setup};$('connection').textContent=copy.online;}catch{$('connection').textContent=copy.offline;}
      engine=new window.KR_RallyEngine();state=engine.start({edition,seed,...setup});ticks=0;inputs=[];lastTarget=null;target=state.playerX;targetY=C.config.court.playerY*C.height;acc=0;last=performance.now();powerSerial=0;playing=true;document.body.classList.add('playing');setPaused(false);$('splash').hidden=true;$('pause').disabled=false;$('submit-score').hidden=true;$('start').textContent=copy.again;say(copy.waiting);track('start');syncUpdate();void ranking();$('court').focus({preventScroll:true});
    }finally{starting=false;$('start').disabled=false;$('court-action').disabled=false;syncCourtAction();if(!playing)lockSetup(false);syncUpdate();}
  }
  function powerNotice(event){
    if(!event||event.serial===powerSerial)return;powerSerial=event.serial;
    const player=C.roster(edition).find(p=>p.id===event.player),power=C.powers[event.power];progress.meet(player.id);renderProgress();
    $('power-name').textContent=player.name+' · '+power[lang][0];$('power-effect').textContent=power[lang][1];track('power_'+event.power);
    if(!seenSet.has(event.power)){
      setPaused(true);$('effect-title').textContent=player.name+' · '+power[lang][0];$('effect-copy').textContent=power[lang][1];$('effect-dialog').showModal();V.drawPowerPreview($('effect-preview'),event.power,lang);
      $('effect-close').onclick=()=>{seenSet.add(event.power);store.set('seen:visual-1',[...seenSet]);$('effect-dialog').close();setPaused(false);};
    }
  }
  function finish(){
    playing=false;syncCourtAction();lockSetup(false);document.body.classList.remove('playing');$('pause').disabled=true;completed=session?{...session,ticks,inputs:inputs.map(row=>row.slice())}:null;
    result={edition,...runSetup,score:state.smashes,level:state.level,verified:false};const before=progress.finish(result),best=Math.max(before,state.smashes);
    $('result-goal').textContent=state.smashes>before?(lang==='fr'?'Nouveau record ! +':'New best! +')+(state.smashes-before):(lang==='fr'?'Encore ':'Just ')+(before-state.smashes+1)+(lang==='fr'?' points pour battre ton record.':' points to beat your best.');
    $('result-goal').textContent+=' '+(lang==='fr'?'Prochain objectif : ':'Next goal: ')+(Math.ceil((Math.max(best,state.smashes)+1)/10)*10)+' pts.';
    $('result-scope').textContent=(lang==='fr'?'Résultat local · ':'Local result · ')+(runSetup.mode==='daily'?copy.daily+' '+runSetup.day+' UTC':copy.classic)+(runSetup.style==='advanced'?(lang==='fr'?' · avancé':' · advanced'):'')+(runSetup.precision?(lang==='fr'?' · précision':' · precision'):'');$('share-state').textContent='';$('share-fallback').hidden=true;renderProgress();syncUpdate();
    $('result-score').textContent=state.smashes+' '+(lang==='fr'?'points':'points');$('result-copy').textContent=state.totalSmashed+' '+copy.ended.replace('{w}',state.winners).replace('{best}',best);$('result-dialog').showModal();$('submit-score').hidden=!completed;track('end');
    void api('newsletter').then(data=>{$('newsletter').hidden=data.enabled!==true;}).catch(()=>{});
  }
  function frame(now){
    const delta=last?Math.min(250,now-last):0;last=now;
    if(playing&&!paused&&!modalOpen()){
      acc+=delta;
      while(acc>=C.tickMs&&playing&&!paused){
        if(keys.left!==keys.right)target=Math.max(20,Math.min(C.width-20,target+(keys.right?1:-1)*6.5));
        if(runSetup?.style==='advanced'&&keys.up!==keys.down)targetY=Math.max(engine.run.playerMinY,Math.min(engine.run.playerMaxY,targetY+(keys.down?1:-1)*6.5));
        const x=Math.round(target*10)/10,y=Math.round(targetY*10)/10,key=x+':'+y;
        if(key!==lastTarget){inputs.push([ticks,x,y]);lastTarget=key;}
        const before=state;engine.setTarget(x,y);state=engine.update(C.tickMs);ticks++;acc-=C.tickMs;
        fx.observe(state,lang);
        if(state.lives<before.lives)sound.play('miss');else if(state.winners>before.winners)sound.play('winner');else if(state.powerEvent?.serial!==before.powerEvent?.serial)sound.play('power');else if(state.totalSmashed>before.totalSmashed)sound.play('hit');else if(state.ball?.landedAt>0&&state.ball.landedAt!==before.ball?.landedAt)sound.play('bounce');
        if(state.lives<before.lives)say(copy.lost);else if(state.savedAt!==before.savedAt)say(copy.saved);
        if(state.winners>before.winners)say(copy.winner);else if(state.partnerStroke?.at!==before.partnerStroke?.at)say(state.partnerStroke?.middle?(lang==='fr'?'Ton partenaire prend le milieu !':'Your partner takes the middle!'):(lang==='fr'?'Ton partenaire renvoie !':'Your partner returns!'));
        powerNotice(state.powerEvent);
        if(ticks>=C.maxTicks&&!state.done){engine.run.done=true;engine.run.endReason='TIME';state=engine.getState();}
        if(state.done)finish();
      }
    }else acc=0;
    V.draw($('court'),state,lang);
    $('round-rule').textContent=(lang==='fr'?'MANCHE · ':'ROUND · ')+C.rounds[state.roundProfile||0][lang];
    $('capture-note').textContent=state.ball?.state==='HELD'?(lang==='fr'?'CAPTURE · Place-toi pour viser · départ dans ':'CATCH · Move to aim · release in ')+Math.max(1,Math.ceil((state.captureUntil-state.elapsedMs)/1000))+' s':state.captureReady?(lang==='fr'?'Bonus de manche : une capture automatique pour préparer ta frappe.':'Round bonus: one automatic catch to prepare your shot.'):'';
    $('round-goal').textContent=(lang==='fr'?'OBJECTIF · ':'GOAL · ')+(state.totalSmashed%8)+'/8 '+(lang==='fr'?'RENVOIS':'RETURNS');
    const combo=state.currentStreak>=3?'COMBO · '+state.currentStreak+(lang==='fr'?' RENVOIS':' RETURNS'):'';if($('combo').textContent!==combo)$('combo').textContent=combo;
$('rush').textContent=state.rushUntil>state.elapsedMs?('RUSH · +'+(state.precision?3:2)+(lang==='fr'?' par renvoi · ':' per return · '))+Math.ceil((state.rushUntil-state.elapsedMs)/1000)+' s':(lang==='fr'?'RUSH : ':'RUSH: ')+state.rushReturns+'/5 · '+(lang==='fr'?'5 renvois sans rater → +'+(state.precision?3:2)+' par renvoi pendant 6 s':'5 returns without a miss → +'+(state.precision?3:2)+' per return for 6 s');$('score').textContent=state.smashes;$('level').textContent=state.level;$('lives').textContent='♥ '.repeat(state.lives)+'♡ '.repeat(3-state.lives);$('lives').setAttribute('aria-label',copy.lives+' '+state.lives+'/3');
    const assist=state.assist;$('power-progress').value=assist?Math.max(0,(assist.until-state.elapsedMs)/(C.powers[assist.key].seconds*1000)):0;
    if(assist){$('power-effect').textContent=C.powers[assist.key][lang][1]+' · '+Math.ceil((assist.until-state.elapsedMs)/1000)+' '+copy.seconds+(assist.charges>0?' · '+assist.charges+' '+copy.charges:'');}else if(powerSerial&&state.elapsedMs-(state.powerEvent?.at||0)<3500){$('power-effect').textContent=C.powers[state.powerEvent.power][lang][1];}else if(powerSerial){$('power-effect').textContent=lang==='fr'?'Pouvoir terminé. Prochain joueur dans '+Math.max(0,engine.run.nextPowerAt-state.totalSmashed)+' renvois.':'Power ended. Next player in '+Math.max(0,engine.run.nextPowerAt-state.totalSmashed)+' returns.';}
    if(performance.now()>feedbackUntil)$('feedback').textContent='';
    requestAnimationFrame(frame);
  }
  let pointer=null;
  function move(e){const rect=$('court').getBoundingClientRect();const point=V.pointerPosition($('court'),e.clientX,rect.top+targetY/C.height*rect.height);target=Math.max(20,Math.min(C.width-20,point.x));if(runSetup?.style==='advanced'){const depth=V.pointerPosition($('court'),e.clientX,e.clientY,e.pointerType==='touch'?35:0);targetY=Math.max(engine.run.playerMinY,Math.min(engine.run.playerMaxY,depth.y));}}
  $('court').addEventListener('pointerdown',e=>{if(!playing){void start();return;}if(paused){setPaused(false);return;}if(pointer!==null)return;pointer=e.pointerId;$('court').setPointerCapture(pointer);move(e);});
  $('court').addEventListener('pointermove',e=>{if(playing&&!paused&&(e.pointerType==='mouse'||e.pointerId===pointer))move(e);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('court').addEventListener(name,()=>{pointer=null;});
  window.addEventListener('keydown',e=>{if(starting||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||modalOpen()||(e.code==='Space'&&/BUTTON|A|SUMMARY/.test(document.activeElement?.tagName)))return;if(e.key.startsWith('Arrow')&&playing){const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];if(direction){e.preventDefault();keys[direction]=true;}}if(e.key.toLowerCase()==='p'&&playing){e.preventDefault();setPaused(!paused);}if(e.code==='Space'){e.preventDefault();if(!playing)void start();else setPaused(!paused);}});
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;if(e.key==='ArrowUp')keys.up=false;if(e.key==='ArrowDown')keys.down=false;});
  window.addEventListener('blur',()=>{if(playing)setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)setPaused(true);});
  for(const input of document.querySelectorAll('.setup input,.setup select'))input.addEventListener('change',()=>{if(playing||starting)return;runSetup=null;modeNote();lockSetup(false);void ranking();store.set('setup',choices());state=engine.start({edition,...choices()});target=state.playerX;targetY=state.playerY;});
  $('pause').onclick=()=>setPaused(!paused);$('start').onclick=()=>void start();$('again').onclick=()=>void start();$('result-close').onclick=()=>{$('result-dialog').close();$('submit-score').scrollIntoView({block:'center',behavior:'smooth'});};
  $('effect-dialog').addEventListener('cancel',e=>e.preventDefault());
  async function ranking(){
    $('ranking-status').textContent=copy.loading;
    const c=runSetup||choices();$('board-scope').textContent=(c.mode==='daily'?copy.daily+' · '+c.day+' UTC':copy.classic)+(c.style==='advanced'?' · '+(lang==='fr'?'avancé':'advanced'):' · arcade')+(c.precision?' · '+(lang==='fr'?'précision':'precision'):'');
    try{const data=await api('leaderboard?edition='+edition+'&version='+C.version+'&mode='+c.mode+'&day='+c.day+'&style='+c.style+'&precision='+c.precision);$('ranking').replaceChildren();for(const row of data.entries){const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=row.name;score.textContent=row.score;li.append(name,score);$('ranking').append(li);}$('ranking-status').textContent=data.entries.length?copy.online:copy.empty;}catch{$('ranking-status').textContent=copy.offline;}
  }
  $('refresh').onclick=()=>void ranking();
  $('submit-score').onsubmit=async e=>{e.preventDefault();if(!completed)return;const btn=e.currentTarget.querySelector('button');btn.disabled=true;$('submit-status').textContent=copy.saving;try{await api('scores',{...completed,name:$('nickname').value});completed=null;if(result)result.verified=true;$('result-scope').textContent=copy.savedScore;$('submit-status').textContent=copy.savedScore;track('score_submit');void ranking();}catch{$('submit-status').textContent=copy.failed;}finally{btn.disabled=false;}};
  $('signup').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;$('signup-status').textContent=copy.sending;try{await api('newsletter',{edition,email:$('email').value,consent:$('email-consent').checked,website:$('website').value});$('email').value='';$('email-consent').checked=false;$('signup-status').textContent=copy.subscribed;track('newsletter_accepted');}catch{$('signup-status').textContent=copy.signupError;}finally{btn.disabled=false;}};
  $('power-name').textContent=lang==='fr'?'À toi de jouer.':'Your court.';$('power-effect').textContent=copy.waiting;$('connection').textContent=copy.practice;
  async function shareResult(copyOnly){
    if(!result)return;
    const url=new URL(location.href);url.search='';url.searchParams.set('edition',edition);if(result.mode==='daily')url.searchParams.set('mode','daily');if(result.style==='advanced')url.searchParams.set('style','advanced');if(result.precision)url.searchParams.set('precision','true');
    const text='Kitchen Rush · '+result.score+' pts · '+(lang==='fr'?'manche ':'round ')+result.level+' · '+(result.mode==='daily'?copy.daily+' '+result.day+' UTC':copy.classic)+(result.style==='advanced'?(lang==='fr'?' · avancé':' · advanced'):'')+(result.precision?(lang==='fr'?' · précision':' · precision'):'')+' · '+(result.verified?(lang==='fr'?'score vérifié':'verified score'):(lang==='fr'?'score local':'local score'));
    try{if(!copyOnly&&navigator.share){await navigator.share({title:'Kitchen Rush',text,url:url.href});$('share-state').textContent=lang==='fr'?'Fenêtre de partage ouverte.':'Share window opened.';}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text+'\n'+url.href);$('share-state').textContent=lang==='fr'?'Résultat copié.':'Result copied.';}else throw Error('manual');}
    catch(e){if(e.name==='AbortError')return;$('share-fallback').hidden=false;$('share-fallback').value=text+'\n'+url.href;$('share-fallback').focus();$('share-fallback').select();$('share-state').textContent=lang==='fr'?'Copie ce texte pour le partager.':'Copy this text to share.';}
    if(['localhost','127.0.0.1'].includes(location.hostname))$('share-state').textContent+=(lang==='fr'?' Attention : ce lien local fonctionne sur cet ordinateur uniquement.':' This local link only works on this computer.');
  }
  $('share-result').onclick=()=>void shareResult(false);$('copy-result').onclick=()=>void shareResult(true);
  $('update-game').onclick=()=>{if(playing||starting||!waitingWorker)return;reloading=true;waitingWorker.postMessage({type:'ACTIVATE'});};
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
    void navigator.serviceWorker.register('./sw.js').then(reg=>{
      if(reg.waiting){waitingWorker=reg.waiting;syncUpdate();}
      reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){waitingWorker=worker;syncUpdate();}});});
    }).catch(()=>{});
  }
  const manifest=document.querySelector('link[rel=manifest]');if(edition==='us')manifest.href='./manifest-us.json';

  if(['localhost','127.0.0.1'].includes(location.hostname))window.KR_RALLY_DEBUG={get state(){return state;},get engine(){return engine;},get paused(){return paused;}};
  modeNote();lockSetup(false);renderProgress();syncCourtAction();void ranking();requestAnimationFrame(frame);
})();
