let ws,user=null,roomCode="",session=localStorage.getItem("nexoraSession");
const $=x=>document.getElementById(x);
function connect(cb){if(ws&&ws.readyState===1){if(cb)cb();return}ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);
ws.onopen=()=>{if(session)ws.send(JSON.stringify({type:"session_login",session}));if(cb)setTimeout(cb,100)};
ws.onmessage=e=>{let m=JSON.parse(e.data);
if(m.type==="account"){user=m.profile;session=m.session||session;if(session)localStorage.setItem("nexoraSession",session);localStorage.setItem("nexoraUser",user.username);$("account").hidden=true;$("profile").hidden=false;$("logout").hidden=false;$("welcome").textContent="Welcome, "+user.username;$("stats").textContent=`${user.wins} wins • ${user.losses} losses • ${user.score} pts • ${user.collection} cards`;$("rank").textContent=user.rank;$("achievements").innerHTML="<h3>Achievements</h3>"+(user.achievements.length?user.achievements.map(x=>`<span class="badge">${x}</span>`).join(" "):"<p class='muted'>Your first achievement is waiting.</p>")}
if(m.type==="account_error")$("accountMsg").textContent=m.msg;
if(m.type==="room"){roomCode=m.code;$("room").textContent=roomCode;$("battle").hidden=false;$("profile").hidden=true;$("msg").textContent="Room created. Waiting for opponent..."}
if(m.type==="error")$("msg").textContent=m.msg;if(m.type==="notice")$("msg").textContent=m.text;
if(m.type==="battle_state")render(m);if(m.type==="leaderboard")renderBoard(m.rows);
if(m.type==="chat")$("chatlog").innerHTML+=`<div><b>${m.name}:</b> ${m.text}</div>`}
}
function register(){connect(()=>ws.send(JSON.stringify({type:"register",username:$("username").value,password:$("password").value})))}
function login(){connect(()=>ws.send(JSON.stringify({type:"login",username:$("username").value,password:$("password").value})))}
function logout(){if(ws?.readyState===1)ws.send(JSON.stringify({type:"logout"}));localStorage.removeItem("nexoraSession");location.reload()}
function loadLeaderboard(){connect(()=>ws.send(JSON.stringify({type:"leaderboard"})))}
function start(){location.href="arena.html"}
function act(type,name){if(ws?.readyState===1)ws.send(JSON.stringify({type:"action",action:{type,name}}))}
function sendChat(){let t=$("chat").value.trim();if(t)ws.send(JSON.stringify({type:"chat",text:t}));$("chat").value=""}
function renderBoard(rows){$("leaderboard").innerHTML="<h3>Top 50</h3>"+rows.map((r,i)=>`<div class="row"><b>#${i+1} ${r.username}</b><span>${r.rank} · ${r.score} pts · ${r.wins}W</span></div>`).join("")}
function render(m){$("room").textContent=roomCode;$("turn").textContent=m.winner!==null?`PLAYER ${m.winner+1} WINS`:`TURN: ${m.turn===m.you?"YOUR TURN":"OPPONENT'S TURN"}`;$("players").innerHTML=m.players.map((p,i)=>`<div class="cardline"><b>${i===m.you?"YOU":"RIVAL"} — ${p.name}</b><div class="bar"><i style="width:${Math.max(0,p.hp/p.maxHp*100)}%"></i></div><small>Active: ${p.active} · HP ${p.hp}/${p.maxHp} · Energy ${p.energy} · KO ${p.ko}</small><br><small>Bench: ${p.bench.join(", ")||"empty"} · Deck: ${p.deckSize} · Hand: ${p.handSize}</small></div>`).join("")}
