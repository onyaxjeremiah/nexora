let ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host),me=0,state=null;
const $=id=>document.getElementById(id);
ws.onopen=()=>{const s=localStorage.getItem("nexoraSession"),room=localStorage.getItem("nexoraRoom"),pid=localStorage.getItem("nexoraPid");if(s)ws.send(JSON.stringify({type:"session_login",session:s}));if(room&&pid)ws.send(JSON.stringify({type:"resume",code:room,pid}));};
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="battle_state"){state=m;me=m.you;render()}if(m.type==="room"){localStorage.setItem("nexoraRoom",m.code);if(m.pid)localStorage.setItem("nexoraPid",m.pid)}if(m.type==="notice")$("msg").textContent=m.text;if(m.type==="action_error")$("msg").textContent=m.msg;if(m.type==="chat"){$("chatlog").innerHTML+=`<div><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`;$('chatlog').scrollTop=$('chatlog').scrollHeight}if(m.type==="error")$("msg").textContent=m.msg};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function send(action){if(ws.readyState===1)ws.send(JSON.stringify({type:"action",action}))}
function draw(){send({type:"draw"})} function attack(){send({type:"attack"})} function endTurn(){send({type:"end_turn"})}
function play(name,kind){
 if(!state||state.winner!==null)return;
 if(kind==="Basic"){send({type:"play_basic",name});return}
 if(kind==="Energy"){send({type:"play_energy",name});return}
 if(kind==="Evolved"){send({type:"play_evolution",name});return}
 if(kind==="Deadly"){send({type:"deadly",name});return}
 const needs={"Nexora Search":2,"Supporter Search":1,"Nexora Finder":1,"Energy Search":1,"Energy Boost":2,"Recovery":2};
 if(needs[name])return chooseCards(name,needs[name]);
 if(name==="Nexora Heal"||name==="Nexora Switch")return chooseBench(name);
 send({type:"supporter",name});
}
function chooseCards(name,n){
 const p=state.players[me],source=name==="Recovery"?"discard":"deck",pool=p[source]||[];
 const valid=pool.filter(c=>name==="Nexora Search"?(c.kind==="Basic"||c.kind==="Evolved"):name==="Supporter Search"?c.kind==="Supporter":name==="Energy Search"||name==="Energy Boost"?c.kind==="Energy":true);
 if(valid.length<n){alert(`Not enough valid cards for ${name}.`);return}
 let picked=[];
 $("chooseTitle").textContent=`${name} — choose ${n}`;
 $("chooseList").innerHTML=valid.map((c,i)=>`<button class="choice" data-i="${i}" onclick="toggleChoice(${i},this)"><b>${esc(c.name)}</b><span>${esc(c.kind)}${c.type?" · "+esc(c.type):""}</span></button>`).join("");
 window._choice={name,n,valid,picked};updateChoice();$("chooser").classList.remove("hidden");
}
function toggleChoice(i,btn){const x=window._choice;if(!x)return;const at=x.picked.indexOf(i);if(at>=0){x.picked.splice(at,1);btn.classList.remove("selected")}else if(x.picked.length<x.n){x.picked.push(i);btn.classList.add("selected")}updateChoice()}
function updateChoice(){const x=window._choice||{picked:[],n:0};$("chooseCount").textContent=`${x.picked.length}/${x.n} selected`;$("chooseConfirm").disabled=x.picked.length!==x.n}
function confirmCards(){const x=window._choice;if(!x||x.picked.length!==x.n)return;const targets=x.picked.map(i=>x.valid[i].name);closeChooser();send({type:"supporter",name:x.name,targets})}
function chooseBench(name){
 const p=state.players[me];if(name==="Nexora Switch"&&!p.bench.length){alert("No Nexora on your bench.");return}
 const items=[{label:`Active: ${p.active} — HP ${p.hp}/${p.maxHp}`,idx:-1},...p.bench.map((x,i)=>({label:`Bench: ${x.name} — HP ${x.hp}/${x.maxHp}`,idx:i}))];
 $("chooseTitle").textContent=`${name} — choose a Nexora`;
 $("chooseList").innerHTML=items.filter(x=>name!=="Nexora Switch"||x.idx>=0).map(x=>`<button class="choice" onclick="pickBench(${x.idx},${JSON.stringify(name)})">${esc(x.label)}</button>`).join("");
 $("chooseConfirm").disabled=true;$("chooseCount").textContent="Choose 1";$("chooser").classList.remove("hidden");
}
function pickBench(idx,name){closeChooser();send({type:"supporter",name,benchIndex:idx})}
function closeChooser(){$("chooser").classList.add("hidden");window._choice=null}
function sendChat(){const t=$("chat").value.trim();if(t&&ws.readyState===1)ws.send(JSON.stringify({type:"chat",text:t}));$("chat").value=""}
function card(c){return `<button class="card ${c.kind.toLowerCase()}" onclick="play(${JSON.stringify(c.name)},${JSON.stringify(c.kind)})"><small>${esc(c.kind)}</small><b>${esc(c.name)}</b><span>${esc(c.type||"")}</span>${c.hp?`<span>HP ${c.hp}</span>`:""}${c.damage?`<span>DMG ${c.damage}</span>`:""}${c.evolvesFrom?`<em>↗ Evolves from ${esc(c.evolvesFrom)}</em>`:""}</button>`}
function render(){
 const p=state.players[me],o=state.players[1-me];
 $("room").textContent=localStorage.getItem("nexoraRoom")||"------";
 $("turn").textContent=state.winner!==null?`PLAYER ${state.winner+1} WINS`:state.turn===me?"YOUR TURN":"OPPONENT'S TURN";
 $("opponent").innerHTML=`<div class="playername">RIVAL: ${esc(o.name)}</div><div class="mini">Active ${esc(o.active)} · HP ${o.hp}/${o.maxHp} · ⚡ ${o.energy} · KOs ${o.ko} · Hand ${o.handSize} · Deck ${o.deckSize}</div>`;
 $("opactive").innerHTML=`<div class="activecard enemy"><b>${esc(o.active)}</b><strong>${o.hp}/${o.maxHp} HP</strong><span>⚡ ${o.energy}</span></div>`;
 $("myactive").innerHTML=`<div class="activecard mine"><b>${esc(p.active)}</b><strong>${p.hp}/${p.maxHp} HP</strong><span>⚡ ${p.energy}</span>${p.power?"<em>POWER UP READY</em>":""}</div>`;
 $("mybench").innerHTML=p.bench.length?p.bench.map((x,i)=>`<button class="benchcard" onclick="chooseSpecificSwitch(${i})"><b>${esc(x.name)}</b><span>${x.hp}/${x.maxHp} HP · ⚡ ${x.energy||0}</span></button>`).join(""):"<span class='muted'>No Nexora on bench</span>";
 $("hand").innerHTML=p.hand.map(card).join("")||"<span class='muted'>Your hand is empty</span>";
 const groups=[["supporters","Supporters","Supporter"],["energy","Energy","Energy"],["deadly","Deadly","Deadly"]];for(const [id,title,kind] of groups){const cs=p.hand.filter(c=>c.kind===kind);$(id).innerHTML=cs.length?`<h3>${title}</h3><div class="rowcards">${cs.map(card).join("")}</div>`:""}
 $("drawBtn").disabled=true;$("attackBtn").disabled=state.turn!==me||p.energy<1||state.winner!==null;$("endBtn").disabled=state.turn!==me||state.winner!==null;
 $("msg").textContent=state.winner!==null?`Battle over — Player ${state.winner+1} wins.`:state.turn===me?"Your turn. Play cards, then attack or end your turn.":"Waiting for opponent…";
}
function chooseSpecificSwitch(i){if(state.turn===me)send({type:"switch",benchIndex:i})}
