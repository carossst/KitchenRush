/* Bounded device-only progress. No emails, nicknames, tokens or replay logs. */
(() => {
  'use strict';
  const key='kr-rally:progress-1',catalog=new Set(window.KR_PLAYER_CATALOG.map(p=>p.id));
  const blank=()=>({met:[],history:[],bests:{}});
  function clean(raw){
    const s=blank();if(!raw||typeof raw!=='object')return s;
    s.met=Array.isArray(raw.met)?[...new Set(raw.met.filter(id=>catalog.has(id)))]:[];
    s.history=Array.isArray(raw.history)?raw.history.filter(h=>h&&['fr','us'].includes(h.edition)&&['classic','daily'].includes(h.mode)&&['arcade','advanced'].includes(h.style)&&Number.isSafeInteger(h.score)&&h.score>=0&&h.score<=10000000&&Number.isInteger(h.level)&&h.level>=1&&h.level<=30&&Number.isFinite(h.at)).slice(-20).map(h=>({edition:h.edition,mode:h.mode,style:h.style,precision:h.precision===true,day:typeof h.day==='string'?h.day.slice(0,10):'',score:h.score,level:h.level,at:h.at})):[];
    for(const [k,v] of Object.entries(raw.bests||{}).slice(-100))if(/^(fr|us):[a-zA-Z0-9:.-]{1,100}$/.test(k)&&Number.isSafeInteger(v)&&v>=0&&v<=10000000)s.bests[k]=v;
    return s;
  }
  function read(){try{return clean(JSON.parse(localStorage.getItem(key)));}catch{return blank();}}
  let s=read();
  function save(){s=clean(s);try{localStorage.setItem(key,JSON.stringify(s));}catch{/* Storage is optional. */}}
  function recordKey(c){return [c.edition,window.KR_RALLY.version,c.mode,c.style,c.precision?'precision':'normal',c.mode==='daily'?c.day:''].join(':');}
  window.KR_RALLY_PROGRESS=Object.freeze({
    clean,snapshot:()=>structuredClone(s),
    best(c){return s.bests[recordKey(c)]||0;},
    meet(id){if(catalog.has(id)&&!s.met.includes(id)){s.met.push(id);save();}},
    finish(c){const before=this.best(c);s.bests[recordKey(c)]=Math.max(before,c.score);s.history.push({...c,at:Date.now()});save();return before;}
  });
  window.addEventListener('storage',e=>{if(e.key===key)s=read();});
})();
