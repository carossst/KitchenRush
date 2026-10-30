/* One ruleset for browser and replay server. Editions change identities and copy only. */
(() => {
  'use strict';
  const config = structuredClone(window.KR_CONFIG);
  config.rally = true;
  config.rallyDoubles = true;
  config.game.powerUps.enabled = false; // Player powers replace the old random unlock system.
  config.game.speed = {base:3.25,accelPerSec:0.025};
  config.game.window = {initialMs:630,decayPerSec:1.5,minMs:330};
  config.game.reboundDelayMs = 100;
  config.game.timing.minBounceVisibleMs = 160;
  config.game.timing.autoHitGraceFrac = 0.26;
  config.game.trajectory.lateralSpreadFrac = 0.42;
  config.court.playerSpeed = 5.8;
  config.court.hitRange = 35;
  config.court.kitchenLineY = config.court.netY + (config.court.baselineY-config.court.netY)*7/22;
  config.canvas.ballRadius = 8;
  const slots = [
    ['giant','platel','waters'],['speed','rocchi','bright'],['slow','roy','johns'],
    ['storm','enmer','black'],['fire','burnel','patriquin'],['shield','loriot','jw'],
    ['multi','khlif','khlif'],['bomb','devilliers','devilliers'],['life','vernaz','jorja'],['multi','sarcelet','todd']
  ].map(([power,fr,us])=>Object.freeze({power,fr,us}));
  // Arcade effects named after real strokes; these are not claims about the athletes.
  const powers = {
    giant:{fr:['VOLÉE BLOQUÉE','Ta raquette grandit pendant 6 secondes. Plus facile de toucher la balle !'],en:['BLOCK VOLLEY','Your paddle grows for 6 seconds. Hitting the ball is easier!'],seconds:6},
    speed:{fr:['ERNE','Tu te déplaces plus vite pendant 6 s.'],en:['ERNE','Move faster for 6 seconds.'],seconds:6},
    slow:{fr:['RESET','L’adversaire envoie les balles plus lentement pendant 6 s.'],en:['RESET','Your opponent sends slower balls for 6 seconds.'],seconds:6},
    storm:{fr:['ATP','Le prochain renvoi vise la ligne extérieure. À toi de le réussir !'],en:['ATP','Your next return targets the outside line. You still have to reach it!'],charges:1,seconds:12},
    fire:{fr:['DRIVE','Tes 2 prochains renvois sont plus rapides.'],en:['DRIVE','Your next 2 returns travel faster.'],charges:2,seconds:12},
    shield:{fr:['DIG','Une balle ratée est sauvée. Protection valable 12 s.'],en:['DIG','One missed ball is saved. Protection lasts 12 seconds.'],charges:1,seconds:12},
    multi:{fr:['VOLÉE RÉFLEXE','Tu attrapes plus facilement tes 2 prochaines balles.'],en:['REFLEX VOLLEY','Your next 2 balls are easier to reach.'],charges:2,seconds:12},
    bomb:{fr:['SMASH','Ton prochain renvoi est beaucoup plus rapide.'],en:['SMASH','Your next return is much faster.'],charges:1,seconds:12},
    life:{fr:['LOB','Récupère une vie, au maximum 3. Si elles sont pleines : +2 points.'],en:['LOB','Recover one life, up to 3. Full lives: +2 points.'],seconds:0}
  };
  function random(seed){let v=seed>>>0;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};}
  function roster(edition){if(!['fr','us'].includes(edition))throw Error('edition');return slots.map(s=>({...window.KR_PLAYER_CATALOG.find(p=>p.id===s[edition]),power:s.power}));}
  window.KR_RALLY = Object.freeze({version:'rally-6',width:480,height:760,tickMs:1000/60,maxTicks:36000,config,slots,powers,random,roster,strategies:Object.freeze({build:Object.freeze({returnSpeed:1.12,counterSpeed:1,arc:1.2}),drive:Object.freeze({returnSpeed:.78,counterSpeed:.85,arc:.75})})});
})();
