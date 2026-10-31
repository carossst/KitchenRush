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
    giant:{fr:['VOLÉE BLOQUÉE · PORTÉE +','Les deux raquettes gagnent de la portée pendant 6 s.'],en:['BLOCK VOLLEY · REACH +','Both paddles gain reach for 6 seconds.'],seconds:6},
    speed:{fr:['ERNE · VITESSE +','Ton équipe se déplace plus vite pendant 6 s.'],en:['ERNE · SPEED +','Your team moves faster for 6 seconds.'],seconds:6},
    slow:{fr:['RESET · BALLE RALENTIE','L’adversaire envoie les balles plus lentement pendant 6 s.'],en:['RESET · SLOW BALL','Your opponent sends slower balls for 6 seconds.'],seconds:6},
    storm:{fr:['ATP · LIGNE EXTÉRIEURE','Le prochain renvoi de ton équipe vise la ligne extérieure.'],en:['ATP · OUTSIDE LINE','Your team’s next return targets the outside line.'],charges:1,seconds:12},
    fire:{fr:['DRIVE · 2 RENVOIS RAPIDES','Les 2 prochains renvois de ton équipe sont plus rapides.'],en:['DRIVE · 2 FAST RETURNS','Your team’s next 2 returns travel faster.'],charges:2,seconds:12},
    shield:{fr:['DIG · 1 BALLE SAUVÉE','Une balle ratée est sauvée. Protection valable 12 s.'],en:['DIG · 1 BALL SAVED','One missed ball is saved. Protection lasts 12 seconds.'],charges:1,seconds:12},
    multi:{fr:['VOLÉE RÉFLEXE · 2 RENVOIS AIDÉS','Ton équipe atteint plus facilement ses 2 prochaines balles.'],en:['REFLEX VOLLEY · 2 EASIER RETURNS','Your team’s next 2 balls are easier to reach.'],charges:2,seconds:12},
    bomb:{fr:['SMASH · 1 RENVOI PUISSANT','Le prochain renvoi de ton équipe est beaucoup plus rapide.'],en:['SMASH · 1 POWER RETURN','Your team’s next return is much faster.'],charges:1,seconds:12},
    life:{fr:['LOB · +1 VIE','Récupère une vie, au maximum 3. Si elles sont pleines : +2 points.'],en:['LOB · +1 LIFE','Recover one life, up to 3. Full lives: +2 points.'],seconds:0}
  };
  for(const power of Object.values(powers)){Object.freeze(power.fr);Object.freeze(power.en);Object.freeze(power);}
  Object.freeze(powers);Object.freeze(slots);
  const rounds=Object.freeze([
    {fr:'Trouve ton angle',en:'Find your angle',formation:[144,336],pace:1},
    {fr:'Vise le milieu',en:'Aim for the middle',formation:[95,385],pace:1},
    {fr:'Vise les côtés',en:'Aim for the sidelines',formation:[185,295],pace:1},
    {fr:'Lent puis rapide',en:'Slow then fast',formation:[115,365],pace:1},
    {fr:'Ouverture à gauche',en:'Left opening',formation:[210,375],pace:1},
    {fr:'Ouverture à droite',en:'Right opening',formation:[105,270],pace:1}
  ].map(p=>Object.freeze({...p,formation:Object.freeze(p.formation)})));
  function dailySeed(day){let seed=2166136261;for(const c of 'rally-8:'+day)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;return seed;}
  function random(seed){let v=seed>>>0;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};}
  function roster(edition){
    if(!['fr','us'].includes(edition))throw Error('edition');
    const other=edition==='fr'?'us':'fr';
    return slots.map(s=>{
      const player=window.KR_PLAYER_CATALOG.find(p=>p.id===s[edition]),equivalent=window.KR_PLAYER_CATALOG.find(p=>p.id===s[other]);
      if(!player||!equivalent||!powers[s.power])throw Error('Invalid player pair');
      return Object.freeze({...player,power:s.power,effect:powers[s.power],equivalent:Object.freeze({id:equivalent.id,name:equivalent.name})});
    });
  }
  window.KR_RALLY = Object.freeze({version:'rally-8',width:480,height:760,tickMs:1000/60,maxTicks:36000,config,slots,powers,rounds,dailySeed,random,roster,strategies:Object.freeze({build:Object.freeze({returnSpeed:1.12,counterSpeed:1,arc:1.2}),drive:Object.freeze({returnSpeed:.78,counterSpeed:.85,arc:.75})})});
})();
