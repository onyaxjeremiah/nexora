const http=require("http"),fs=require("fs"),path=require("path"),WebSocket=require("ws");
const PORT=process.env.PORT||3000,rooms=new Map(),sessions=new Map();
const SESSION_TTL=24*60*60*1000;
function makeToken(){return require("crypto").randomBytes(24).toString("hex")}
function makePid(){return require("crypto").randomBytes(10).toString("hex")}
function cleanText(v,n=120){return String(v||"").replace(/[<>]/g,"").replace(/[^\\x20-\\x7E]/g,"").slice(0,n)}
function requireAuth(ws){let u=ws.user;return u&&accounts[u]&&sessions.get(ws.session)?.user===u}
function makeSession(u){let token=makeToken();sessions.set(token,{user:u,expires:Date.now()+SESSION_TTL});return token}
function restoreSession(ws,token){let x=sessions.get(String(token||""));if(!x||x.expires<Date.now())return false;ws.session=token;ws.user=x.user;x.expires=Date.now()+SESSION_TTL;return true}
const defs={};
const names=[
["Blazetail","Basic","Fire",70,30],["Coralyn","Basic","Water",70,30],["Thornfang","Basic","Nature",70,30],["Voltiger","Basic","Lightning",70,30],["Stoneback","Basic","Earth",80,30],["Glacub","Basic","Ice",70,30],["Duskwing","Basic","Shadow",70,30],["Emberclaw","Basic","Fire",80,40],["Tidefang","Basic","Water",80,40],["Mossram","Basic","Nature",80,40],["Sparkjaw","Basic","Lightning",80,40],["Cragor","Basic","Earth",90,40],["Frosthorn","Basic","Ice",80,40],["Shadeon","Basic","Shadow",80,40],["Flareonix","Basic","Fire",90,50],["Rivermane","Basic","Water",90,50],["Vinewyrm","Basic","Nature",90,50],
["InfernaX","Evolved","Fire",180,60,"Blazetail"],["Aqualith","Evolved","Water",180,60,"Coralyn"],["Thornrage","Evolved","Nature",180,60,"Thornfang"],["Voltaris","Evolved","Lightning",180,60,"Voltiger"],["Granitor","Evolved","Earth",190,60,"Stoneback"],["Cryonox","Evolved","Ice",180,60,"Glacub"],["Nightreign","Evolved","Shadow",180,60,"Duskwing"],["Emberlord","Evolved","Fire",190,70,"Emberclaw"],["Tidebreaker","Evolved","Water",190,70,"Tidefang"],["Mossbehemoth","Evolved","Nature",190,70,"Mossram"],
["Nexora Search","Supporter","","",0],["Safe Turn","Supporter","","",0],["Supporter Search","Supporter","","",0],["Recovery","Supporter","","",0],["Nexora Finder","Supporter","","",0],["Energy Search","Supporter","","",0],["Nexora Heal","Supporter","","",0],["Energy Boost","Supporter","","",0],["Nexora Switch","Supporter","","",0],["Power Up","Supporter","","",0],
["Fire Energy","Energy","Fire","",0],["Water Energy","Energy","Water","",0],["Nature Energy","Energy","Nature","",0],["Lightning Energy","Energy","Lightning","",0],["Earth Energy","Energy","Earth","",0],["Ice Energy","Energy","Ice","",0],["Shadow Energy","Energy","Shadow","",0],["Wild Energy","Energy","","",0],["Power Energy","Energy","","",0],["Aqua Energy","Energy","Water","",0],["Nova Energy","Energy","","",0],["Core Energy","Energy","","",0],["Spirit Energy","Energy","","",0],["Storm Energy","Energy","Lightning","",0],["Flame Energy","Energy","Fire","",0],
["Meteor Doom","Deadly","","",70],["Final Cyclone","Deadly","","",50],["Thunder Judgment","Deadly","","",90],["Inferno Apocalypse","Deadly","","",110],["Nexora Omega","Deadly","","",130]];
names.forEach((x,i)=>defs[x[0]]={id:i,name:x[0],kind:x[1],type:x[2],hp:x[3]||0,damage:x[4]||0,evolvesFrom:x[5]||null});

function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function validDeck(deckNames){
 if(!Array.isArray(deckNames)||deckNames.length!==40)return false;
 const counts={};let hasBasic=false;
 for(const n of deckNames){if(!defs[n])return false;counts[n]=(counts[n]||0)+1;if(counts[n]>4)return false;if(defs[n].kind==="Basic")hasBasic=true;}
 return hasBasic;
}
function makePlayer(ws,name,deckNames){
 let raw=validDeck(deckNames)?deckNames.slice():[];
 if(!raw.length) raw=[...Array(40)].map((_,i)=>names[i%names.length][0]);
 let d=shuffle(raw.map(n=>({...defs[n]})));
 let firstIndex=d.findIndex(x=>x.kind==="Basic");
 if(firstIndex<0) firstIndex=0;
 let first=d.splice(firstIndex,1)[0];
 let hand=d.splice(0,5);
 return {ws,pid:makePid(),name:String(name||"Player").slice(0,20),deck:d,hand,discard:[],active:{name:first.name,type:first.type,hp:first.hp,maxHp:first.hp,damage:first.damage,energy:0},bench:[],ko:0,energyUsed:false,shield:false,power:false,hasDrawn:false,disconnected:false};
}
function pub(p,own){
 return {name:p.name,hp:p.active.hp,maxHp:p.active.maxHp,ko:p.ko,active:p.active.name,activeType:p.active.type,energy:p.active.energy||0,
 bench:p.bench.map(x=>({name:x.name,type:x.type,hp:x.hp,maxHp:x.maxHp,damage:x.damage,energy:x.energy||0})),
 handSize:p.hand.length,hand:own?p.hand.map(x=>({name:x.name,kind:x.kind,type:x.type,damage:x.damage||0,hp:x.hp||0,evolvesFrom:x.evolvesFrom||null})):[],
 deckSize:p.deck.length,deck:own?p.deck.map(x=>({name:x.name,kind:x.kind,type:x.type,hp:x.hp||0,damage:x.damage||0,evolvesFrom:x.evolvesFrom||null})):[],
 discardSize:p.discard.length,discard:own?p.discard.map(x=>({name:x.name,kind:x.kind,type:x.type,hp:x.hp||0,damage:x.damage||0,evolvesFrom:x.evolvesFrom||null})):[],
 energyUsed:p.energyUsed,power:p.power,shield:p.shield,own:!!own};
}
function state(r){r.p.forEach((p,i)=>{if(p.ws.readyState===1)p.ws.send(JSON.stringify({type:"battle_state",you:i,turn:r.turn,started:r.started,winner:r.winner,players:r.p.map((x,j)=>pub(x,i===j))}))})}
function msg(r,t){r.p.forEach(p=>{if(p.ws.readyState===1)p.ws.send(JSON.stringify({type:"notice",text:t}))})}
function beginTurn(r,i){let p=r.p[i];r.turn=i;p.energyUsed=false;p.hasDrawn=false;p.turnActions=0;if(p.deck.length){p.hand.push(p.deck.shift());p.hasDrawn=true}else{msg(r,p.name+" has no cards left to draw.")};state(r)}
function endTurn(r){if(r.winner!==null)return;beginTurn(r,1-r.turn)}
function reject(r,i,text){const p=r.p[i];if(p&&p.ws.readyState===1)p.ws.send(JSON.stringify({type:"action_error",msg:text}))}
function finish(r,winner,reason){r.winner=winner;let a=r.p[winner],b=r.p[1-winner];if(a.ws.user&&accounts[a.ws.user])accounts[a.ws.user].wins++;if(b.ws.user&&accounts[b.ws.user])accounts[b.ws.user].losses++;saveAccounts();msg(r,reason||a.name+" wins the battle!");state(r)}
function promoteAfterKO(r,loser){let p=r.p[loser];if(p.bench.length){p.active=p.bench.shift();return true}return false}
function damage(r,i,d){let p=r.p[i],o=r.p[1-i];if(o.shield){o.shield=false;msg(r,"Safe Turn blocked the attack.");return}
 o.active.hp=Math.max(0,o.active.hp-d);
 if(o.active.hp===0){p.ko++;msg(r,p.name+" scored a KO!");if(p.ko>=3){finish(r,i,p.name+" reached 3 KOs and wins!");return}
   if(!promoteAfterKO(r,1-i)){finish(r,i,p.name+" wins — the opponent has no Nexora left!");return}
 }
}
function supporter(r,i,name,targets=[],benchIndex=null){
 let p=r.p[i],o=r.p[1-i],k=p.hand.findIndex(c=>c.name===name);if(k<0)return false;
 const c=p.hand[k];
 const takeExact=(source,n,pred)=>{
   const wanted=targets.slice(0,n); if(wanted.length!==n)return false;
   const used=[];
   for(const wantedName of wanted){const j=source.findIndex(x=>x.name===wantedName&&pred(x)&&!used.includes(x));if(j<0){used.length=0;return false}used.push(source[j])}
   for(const x of used)source.splice(source.indexOf(x),1);
   p.hand.push(...used);return true;
 };
 // Move the Supporter to discard only after its effect validates.
 if(name==="Nexora Search"){
   const ok=takeExact(p.deck,2,x=>x.kind==="Basic"||x.kind==="Evolved");if(!ok)return false;p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Supporter Search"){
   const ok=takeExact(p.deck,1,x=>x.kind==="Supporter");if(!ok)return false;p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Nexora Finder"){
   const ok=takeExact(p.deck,1,()=>true);if(!ok)return false;p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Energy Search"){
   const ok=takeExact(p.deck,1,x=>x.kind==="Energy");if(!ok)return false;p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Energy Boost"){
   const ok=takeExact(p.deck,2,x=>x.kind==="Energy");if(!ok)return false;p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Recovery"){
   const candidates=p.discard.filter(x=>x!==c);
   const wanted=targets.slice(0,2);if(wanted.length!==2)return false;
   const got=[];for(const n of wanted){const x=candidates.find(x=>x.name===n&&!got.includes(x));if(!x)return false;got.push(x)}
   for(const x of got)p.discard.splice(p.discard.indexOf(x),1);p.hand.push(...got);p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Nexora Heal"){
   let target=null;
   if(benchIndex===-1)target=p.active;else if(Number.isInteger(benchIndex)&&p.bench[benchIndex])target=p.bench[benchIndex];else return false;
   target.hp=Math.min(target.maxHp,target.hp+50);p.hand.splice(k,1);p.discard.push(c);return true;
 }
 if(name==="Safe Turn"){o.shield=true;p.hand.splice(k,1);p.discard.push(c);return true}
 if(name==="Power Up"){p.power=true;p.hand.splice(k,1);p.discard.push(c);return true}
 if(name==="Nexora Switch"){
   if(!Number.isInteger(benchIndex)||!p.bench[benchIndex])return false;
   let old=p.active,b=p.bench.splice(benchIndex,1)[0];p.active=b;p.bench.push(old);p.hand.splice(k,1);p.discard.push(c);return true;
 }
 return false;
}
function act(r,i,a){
 if(!r.started||r.winner!==null||r.turn!==i)return reject(r,i,"It is not your turn.");
 const p=r.p[i],o=r.p[1-i];
 if(a.type==="end_turn"){endTurn(r);return}
 if(a.type==="draw"){return reject(r,i,"Cards are drawn automatically at the start of your turn.")}
 if(a.type==="energy"||a.type==="play_energy"){
   if(p.energyUsed)return reject(r,i,"You already attached Energy this turn.");
   const k=p.hand.findIndex(c=>c.kind==="Energy"&&(!a.name||c.name===a.name));
   if(k<0)return reject(r,i,"That Energy card is not in your hand.");
   p.hand.splice(k,1);p.energyUsed=true;p.active.energy++;state(r);return;
 }
 if(a.type==="attack"){
   if(p.active.energy<1)return reject(r,i,"You need at least 1 Energy to attack.");
   let d=p.active.damage+(p.power?30:0);p.power=false;damage(r,i,d);if(r.winner===null)endTurn(r);else state(r);return;
 }
 if(a.type==="switch"){
   if(!Number.isInteger(a.benchIndex)||!p.bench[a.benchIndex])return reject(r,i,"Choose a Nexora on your bench.");
   let old=p.active,b=p.bench.splice(a.benchIndex,1)[0];p.active=b;p.bench.push(old);state(r);return;
 }
 if(a.type==="play_basic"){
   if(p.bench.length>=5)return reject(r,i,"Your bench is full.");
   let k=p.hand.findIndex(c=>c.name===a.name&&c.kind==="Basic");if(k<0)return reject(r,i,"That Basic Nexora is not in your hand.");
   let c=p.hand.splice(k,1)[0];p.bench.push({name:c.name,type:c.type,hp:c.hp,maxHp:c.hp,damage:c.damage,energy:0});state(r);return;
 }
 if(a.type==="play_evolution"||a.type==="evolve"){
   const target=a.name? p.hand.find(c=>c.name===a.name&&c.kind==="Evolved"&&c.evolvesFrom===p.active.name):p.hand.find(c=>c.kind==="Evolved"&&c.evolvesFrom===p.active.name);
   if(!target)return reject(r,i,"That Evolution does not match your active Nexora.");
   const k=p.hand.indexOf(target),old=p.active;let c=p.hand.splice(k,1)[0];
   p.discard.push({...old,maxHp:old.maxHp});
   p.active={name:c.name,type:c.type,hp:c.hp,maxHp:c.hp,damage:c.damage,energy:old.energy};state(r);return;
 }
 if(a.type==="supporter"){
   const ok=supporter(r,i,a.name,a.targets||[],Number.isInteger(a.benchIndex)?a.benchIndex:null);
   if(ok)state(r); else reject(r,i,"That Supporter cannot be played with the selected target.");
   return;
 }
 if(a.type==="deadly"){
   let k=p.hand.findIndex(c=>c.name===a.name&&c.kind==="Deadly");if(k<0)return reject(r,i,"That Deadly card is not in your hand.");
   if(p.active.energy<1)return reject(r,i,"You need at least 1 Energy to use a Deadly card.");
   let c=p.hand.splice(k,1)[0];p.discard.push(c);let d=c.damage+(p.power?30:0);p.power=false;
   if(c.name==="Final Cyclone"&&o.bench.length){let old=o.active,b=o.bench.shift();o.active=b;o.bench.push(old);msg(r,"Final Cyclone switched the opponent's active Nexora!");}
   damage(r,i,d);if(r.winner===null)endTurn(r);else state(r);return;
 }
 reject(r,i,"Unknown action.");
}
const DB_FILE=path.join(__dirname,"nexora_accounts.json");
let accounts={};
try{accounts=JSON.parse(fs.readFileSync(DB_FILE,"utf8"))}catch{}
function saveAccounts(){fs.writeFileSync(DB_FILE,JSON.stringify(accounts,null,2))}
function safeUser(v){return String(v||"").trim().slice(0,20).replace(/[^a-zA-Z0-9_ -]/g,"")}
function getRank(a){
 let score=a.wins*3-a.losses;
 if(score>=60)return "Nexora Master";
 if(score>=30)return "Nexora Elite";
 if(score>=15)return "Nexora Veteran";
 if(score>=5)return "Nexora Challenger";
 return "Nexora Rookie";
}
function getAchievements(a){
 let out=[];
 if(a.wins>=1)out.push("First Victory");
 if(a.wins>=10)out.push("Battle Veteran");
 if(a.wins>=25)out.push("Nexora Champion");
 if(a.collection.length>=39)out.push("Collector");
 if(a.collection.length>=57)out.push("Full Set");
 return out;
}
function publicProfile(a){return {username:a.username,wins:a.wins,losses:a.losses,collection:a.collection.length,deck:a.deck.length,rank:getRank(a),achievements:getAchievements(a),score:a.wins*3-a.losses}}
function defaultCollection(){return names.map(x=>x[0])}
function leaderboard(){
 return Object.values(accounts).map(a=>({username:a.username,wins:a.wins,losses:a.losses,score:a.wins*3-a.losses,rank:getRank(a),achievements:getAchievements(a).length}))
 .sort((a,b)=>b.score-a.score||b.wins-a.wins).slice(0,50);
}

const server=http.createServer((req,res)=>{let f=req.url==="/"?"index.html":req.url.slice(1),p=path.join(__dirname,"public",f);if(!p.startsWith(path.join(__dirname,"public")))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.writeHead(200,{"Content-Type":p.endsWith(".js")?"text/javascript":p.endsWith(".css")?"text/css":"text/html"});res.end(d)})});
const wss=new WebSocket.Server({server});wss.on("connection",ws=>ws.on("message",raw=>{let m;try{m=JSON.parse(raw)}catch{return}
 if(m.type==="register"||m.type==="login"){
   let u=safeUser(m.username),pw=String(m.password||"");
   if(!u||pw.length<4)return ws.send(JSON.stringify({type:"account_error",msg:"Use a username and a password of at least 4 characters."}));
   if(m.type==="register"){
     if(accounts[u])return ws.send(JSON.stringify({type:"account_error",msg:"Username already exists."}));
     accounts[u]={username:u,password:pw,wins:0,losses:0,collection:defaultCollection(),deck:[]};saveAccounts();
   } else if(!accounts[u]||accounts[u].password!==pw)return ws.send(JSON.stringify({type:"account_error",msg:"Username or password is incorrect."}));
   ws.user=u;ws.session=makeSession(u);
ws.send(JSON.stringify({type:"account",session:ws.session,profile:publicProfile(accounts[u]),deck:accounts[u].deck,collection:accounts[u].collection}));
   return;
 }
 if(m.type==="session_login"){
 if(!restoreSession(ws,m.session))return ws.send(JSON.stringify({type:"account_error",msg:"Session expired. Please log in again."}));
 ws.send(JSON.stringify({type:"account",session:ws.session,profile:publicProfile(accounts[ws.user]),deck:accounts[ws.user].deck,collection:accounts[ws.user].collection}));return;
}
if(m.type==="logout"){sessions.delete(ws.session);ws.user=null;ws.session=null;return;}
if(m.type==="save_deck"&&requireAuth(ws)){
   if(!Array.isArray(m.deck)||m.deck.length!==40)return ws.send(JSON.stringify({type:"account_error",msg:"Deck must contain exactly 40 cards."}));
   accounts[ws.user].deck=m.deck.map(String);saveAccounts();ws.send(JSON.stringify({type:"deck_saved",deck:accounts[ws.user].deck}));return;
 }
 if(m.type==="leaderboard"){
 ws.send(JSON.stringify({type:"leaderboard",rows:leaderboard()}));return;
}
if(m.type==="profile"&&requireAuth(ws)){ws.send(JSON.stringify({type:"account",profile:publicProfile(accounts[ws.user]),deck:accounts[ws.user].deck,collection:accounts[ws.user].collection}));return;}
 if(m.type==="create"){if(!validDeck(m.deck||[]))return ws.send(JSON.stringify({type:"error",msg:"Use a valid 40-card deck with no more than 4 copies of a card and at least 1 Basic Nexora."}));let code=Math.random().toString(36).slice(2,8).toUpperCase(),r={p:[],started:false,turn:0,winner:null};rooms.set(code,r);r.p.push(makePlayer(ws,m.name,m.deck));ws.room=code;ws.i=0;ws.send(JSON.stringify({type:"room",code,pid:r.p[0].pid}));}
 else if(m.type==="join"){if(!validDeck(m.deck||[]))return ws.send(JSON.stringify({type:"error",msg:"Use a valid 40-card deck with no more than 4 copies of a card and at least 1 Basic Nexora."}));let code=String(m.code||"").toUpperCase(),r=rooms.get(code);if(!r||r.p.length>=2)return ws.send(JSON.stringify({type:"error",msg:"Room unavailable"}));r.p.push(makePlayer(ws,m.name,m.deck));ws.room=code;ws.i=1;r.started=r.p.every(x=>x.hand.length>0);state(r);msg(r,"Battle started. Player 1 goes first.");ws.send(JSON.stringify({type:"room",code,pid:r.p[1].pid}));}
 else if(m.type==="resume"){
 const code=String(m.code||"").toUpperCase(),r=rooms.get(code);if(!r)return ws.send(JSON.stringify({type:"error",msg:"Room no longer exists."}));
 const idx=r.p.findIndex(x=>x.pid===String(m.pid||"")||(ws.user&&x.ws.user===ws.user));if(idx<0)return ws.send(JSON.stringify({type:"error",msg:"Could not reconnect to that battle."}));
 r.p[idx].ws=ws;r.p[idx].disconnected=false;ws.room=code;ws.i=idx;ws.send(JSON.stringify({type:"room",code,pid:r.p[idx].pid}));state(r);msg(r,r.p[idx].name+" reconnected.");return;
}
if(m.type==="action"){let r=rooms.get(ws.room);if(r)act(r,ws.i,m.action||{})}
 else if(m.type==="chat"){let r=rooms.get(ws.room);if(!r)return;let t=String(m.text||"").replace(/[<>]/g,"").slice(0,120);r.p.forEach(x=>x.ws.send(JSON.stringify({type:"chat",name:r.p[ws.i].name,text:t})))}
})); 
wss.on("connection",ws=>{
 ws.on("close",()=>{ if(ws.room){let r=rooms.get(ws.room);if(r){let p=r.p[ws.i];if(p)p.disconnected=true;msg(r,"A player disconnected. Reconnect with the same session.");}}});
});
server.listen(PORT,()=>console.log("Nexora authoritative server on "+PORT));
