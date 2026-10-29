import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sources=['config.js','players.js','rally-config.js','game.js','rally-rules.js'].map(file=>({file,text:readFileSync(new URL('../'+file,import.meta.url),'utf8')}));
export const VERSION='rally-3',TICK=1000/60,MAX_TICKS=36000;
export function createEngine(seed,edition='fr'){
  const context=vm.createContext({window:{location:{hostname:'localhost'}},structuredClone,URLSearchParams,console});
  for(const {file,text} of sources)vm.runInContext(text,context,{filename:file});
  const engine=new context.window.KR_RallyEngine();engine.start({seed,edition});return engine;
}
export function replay(seed,edition,ticks,inputs){
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(inputs)||inputs.length>ticks)throw Error('inputs');
  let previous=-1;
  for(const row of inputs){if(!Array.isArray(row)||row.length!==3||!Number.isSafeInteger(row[0])||row[0]<=previous||row[0]>=ticks||!Number.isFinite(row[1])||row[1]<0||row[1]>480||Math.abs(row[1]*10-Math.round(row[1]*10))>1e-6||!Number.isFinite(row[2])||row[2]<0||row[2]>760||Math.abs(row[2]*10-Math.round(row[2]*10))>1e-6)throw Error('input');previous=row[0];}
  const engine=createEngine(seed,edition);let at=0,state;
  for(let tick=0;tick<ticks;tick++){
    if(at<inputs.length&&inputs[at][0]===tick)engine.setTarget(inputs[at][1],inputs[at++][2]);
    state=engine.update(TICK);
    if(state.done&&tick!==ticks-1)throw Error('after_end');
  }
  if(!state.done&&ticks!==MAX_TICKS)throw Error('unfinished');
  return {score:state.smashes,level:state.level,winners:state.winners,ticks};
}
