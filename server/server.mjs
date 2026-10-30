/* Portable Node server: static GitHub sources, persistent scores, server-only Kit. */
import http from 'node:http';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {VERSION,MAX_TICKS,replay} from './model.mjs';
import {configured,normalizeEmail,subscribeKit} from './kit.mjs';
export function createServer({dbPath=process.env.KR_DB_PATH||'./kitchen-rush.sqlite',env=process.env,now=Date.now,send=fetch}={}){
  const db=new DatabaseSync(dbPath),root=fileURLToPath(new URL('../',import.meta.url));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,seed INTEGER NOT NULL,edition TEXT NOT NULL,version TEXT NOT NULL,started INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS scores(run_id TEXT PRIMARY KEY,name TEXT NOT NULL,edition TEXT NOT NULL,version TEXT NOT NULL,score INTEGER NOT NULL,level INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS ranking ON scores(version,edition,score DESC);`);
  const runColumns=db.prepare('PRAGMA table_info(runs)').all().map(column=>column.name);
  if(!runColumns.includes('side'))db.exec("ALTER TABLE runs ADD COLUMN side TEXT NOT NULL DEFAULT 'left'");
  if(!runColumns.includes('strategy'))db.exec("ALTER TABLE runs ADD COLUMN strategy TEXT NOT NULL DEFAULT 'build'");
  const envKit={KIT_FORM_FR_ID:'10107559',KIT_FORM_EN_ID:'10110844',KIT_TAG_KITCHEN_RUSH:'25052091',KIT_TAG_FR_ID:'25052095',KIT_TAG_EN_ID:'25052096',...env};
  const allowed=new Set((env.KR_ALLOWED_ORIGINS||'https://carossst.github.io').split(',').map(x=>x.trim()));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const salt=randomBytes(32).toString('hex');
  function rate(ip,scope,limit,ms=60000){const time=now(),key=scope+':'+Math.floor(time/ms)+':'+hash(salt+ip);const row=db.prepare('INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').get(key,time+ms);db.prepare('DELETE FROM rate_limits WHERE expires<?').run(time);return row.hits<=limit;}
  async function body(req,max=900000){if(!req.headers['content-type']?.startsWith('application/json'))throw Error('content_type');let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('size');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString());}
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin,requestOrigin='http://'+req.headers.host;
    const cors=origin&&(allowed.has(origin)||origin===requestOrigin)?origin:null;
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...(cors?{'access-control-allow-origin':cors,'vary':'Origin'}:{})};
    function json(data,status=200){res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
    if(origin&&!cors)return json({error:'origin'},403);
    const path=new URL(req.url,requestOrigin).pathname,ip=req.socket.remoteAddress||'unknown';
    if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'});return res.end();}
    try{
      if(path==='/api/leaderboard'&&req.method==='GET'){
        const q=new URL(req.url,requestOrigin).searchParams,edition=q.get('edition');if(!['fr','us'].includes(edition)||q.get('version')!==VERSION)return json({error:'version'},400);
        const entries=db.prepare('SELECT name,MAX(score) as score FROM scores WHERE edition=? AND version=? GROUP BY lower(name) ORDER BY score DESC,MIN(created) ASC LIMIT 20').all(edition,VERSION);return json({version:VERSION,entries});
      }
      if(path==='/api/newsletter'&&req.method==='GET')return json({enabled:envKit.KIT_SIGNUP_ENABLED==='true'&&configured(envKit)});
      if(path.startsWith('/api/')){
        if(req.method!=='POST')return json({error:'method'},405);
        if(!origin)return json({error:'origin'},403);
        if(!rate(ip,'requests',30))return json({error:'rate'},429);
        const data=await body(req,path==='/api/newsletter'?2048:900000);
        if(path==='/api/runs'){
          if(!['fr','us'].includes(data.edition)||data.version!==VERSION)return json({error:'version'},400);
          const side=data.side??'left',strategy=data.strategy??'build';
          if(!['left','right'].includes(side)||!['build','drive'].includes(strategy))return json({error:'setup'},400);
          if(!rate(ip,'start',12))return json({error:'rate'},429);
          const id=randomUUID(),token=randomBytes(32).toString('hex'),seed=randomBytes(4).readUInt32LE(),started=now();
          db.prepare('DELETE FROM runs WHERE started<? AND used=0').run(started-3600000);
          db.prepare('INSERT INTO runs (id,token_hash,seed,edition,version,started,used,side,strategy) VALUES (?,?,?,?,?,?,0,?,?)').run(id,hash(token),seed,data.edition,VERSION,started,side,strategy);
          return json({id,token,seed,version:VERSION,side,strategy},201);
        }
        if(path==='/api/scores'){
          if(!rate(ip,'score',6))return json({error:'rate'},429);
          if(typeof data.name!=='string'||typeof data.token!=='string'||! /^[a-f0-9]{64}$/.test(data.token))throw Error('identity');
          const name=data.name.normalize('NFKC').trim();if(!/^[\p{L}\p{N} ._'’-]{1,20}$/u.test(name))throw Error('name');
          const run=db.prepare('SELECT * FROM runs WHERE id=?').get(String(data.id));
          if(!run||run.used||run.version!==VERSION||now()-run.started>3600000)return json({error:'run'},400);
          if(!timingSafeEqual(Buffer.from(hash(data.token),'hex'),Buffer.from(run.token_hash,'hex')))return json({error:'token'},403);
          if(!Number.isInteger(data.ticks)||data.ticks>MAX_TICKS||data.ticks/60*1000>now()-run.started+1000)throw Error('duration');
          const result=replay(run.seed,run.edition,data.ticks,data.inputs,run.side,run.strategy);
          db.exec('BEGIN IMMEDIATE');try{const claimed=db.prepare('UPDATE runs SET used=1 WHERE id=? AND used=0').run(run.id);if(claimed.changes!==1)throw Error('claimed');db.prepare('INSERT INTO scores VALUES (?,?,?,?,?,?,?)').run(run.id,name,run.edition,VERSION,result.score,result.level,now());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
          return json(result,201);
        }
        if(path==='/api/newsletter'){
          if(envKit.KIT_SIGNUP_ENABLED!=='true'||!configured(envKit))return json({error:'unavailable'},503);
          if(!['fr','us'].includes(data.edition)||data.consent!==true)throw Error('consent');const email=normalizeEmail(data.email);
          if(data.website)return json({accepted:true},202);
          if(!rate(ip,'newsletter',6,3600000)||!rate(hash(email.toLowerCase()),'email',4,86400000))return json({error:'rate'},429);
          try{await subscribeKit(envKit,data.edition,email,send);return json({accepted:true},202);}catch{return json({error:'unavailable'},503);}
        }
        return json({error:'not_found'},404);
      }
      if(!['GET','HEAD'].includes(req.method))return json({error:'method'},405);
      const relative=decodeURIComponent(path==='/'?'/index.html':path),file=resolve(root,'.'+relative);
      // Never serve source-only server modules, SQLite, dotfiles, secrets or tests.
      if(!file.startsWith(root)||relative.split('/').some(part=>part.startsWith('.'))||relative.startsWith('/server/')||relative.startsWith('/tests/')||!['.html','.js','.css','.json','.svg','.png','.ico'].includes(extname(file)))return json({error:'not_found'},404);
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
      const bytes=await readFile(file);res.writeHead(200,{...headers,'content-type':mime[extname(file)]});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){json({error:error?.code==='ENOENT'?'not_found':'invalid'},error?.code==='ENOENT'?404:400);}
  });
  server.on('close',()=>db.close());return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer();server.listen(Number(process.env.PORT||8790),process.env.HOST||'127.0.0.1',()=>console.log('Kitchen Rush: http://'+(process.env.HOST||'127.0.0.1')+':'+(process.env.PORT||8790)));
}
