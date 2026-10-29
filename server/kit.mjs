/* Kit remains the email/confirmation system. No address is persisted or logged here. */
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const id=value=>/^[1-9]\d*$/.test(String(value||''))?String(value):null;
function settings(env,edition){return {form:id(edition==='fr'?env.KIT_FORM_FR_ID:env.KIT_FORM_EN_ID),common:id(env.KIT_TAG_KITCHEN_RUSH),source:id(edition==='fr'?env.KIT_TAG_FR_ID:env.KIT_TAG_EN_ID)};}
export function configured(env){return !!env.KIT_API_KEY&&['fr','us'].every(edition=>Object.values(settings(env,edition)).every(Boolean));}
export function normalizeEmail(value){
 if(typeof value!=='string')throw Error('email');const email=value.trim();
 if(email.length>254||! /^[^\s@<>\x00-\x1f]+@[^\s@<>\x00-\x1f]+\.[^\s@<>\x00-\x1f]+$/.test(email))throw Error('email');return email;
}
async function boundedJson(response,max=16384){
 if(!response.body)throw Error('body');const reader=response.body.getReader(),parts=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw Error('size');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function subscribeKit(env,edition,email,send=fetch){
 const c=settings(env,edition);if(!['fr','us'].includes(edition)||!configured(env))throw Error('configuration');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 const post=async(path,body)=>{const response=await send('https://api.kit.com/v4/'+path,{method:'POST',headers:{'X-Kit-Api-Key':env.KIT_API_KEY,'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});if(!response.ok){await response.body?.cancel();throw Error('kit_unavailable');}return boundedJson(response);};
 try{
  // Omitting names/custom fields preserves existing profile data. Never reactivate opt-outs.
  const created=await post('subscribers',{email_address:email,state:'inactive'}),subscriber=created.subscriber;
  if(!subscriber||!id(subscriber.id))throw Error('kit_response');
  if(!['active','inactive'].includes(subscriber.state))return {accepted:true};
  await post('forms/'+c.form+'/subscribers/'+subscriber.id,{});
  for(const tag of [c.common,c.source])await post('tags/'+tag+'/subscribers/'+subscriber.id,{});
  return {accepted:true};
 }finally{clearTimeout(timer);}
}
