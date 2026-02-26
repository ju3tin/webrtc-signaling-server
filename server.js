const WebSocket = require("ws");
const http = require("http");

const server = http.createServer((req,res)=>{
  res.writeHead(200,{"Content-Type":"text/plain"});
  res.end("WebSocket boxing server running");
});

const wss = new WebSocket.Server({ server });

// Rooms: roomId => { 1:player1, 2:player2, clients:[ws1, ws2] }
const rooms = new Map();

// Utility for collision detection
function rectCollision(a,b){
  return a && b &&
         a.x < b.x+b.width &&
         a.x+a.width > b.x &&
         a.y < b.y+b.height &&
         a.y+a.height > b.y;
}

function getHitbox(player){
  if(!player.punching) return null;
  if(player.facing===1) return { x:player.x+80, y:player.y+40, width:40, height:20 };
  else return { x:player.x-40, y:player.y+40, width:40, height:20 };
}

wss.on("connection", ws=>{
  console.log("Client connected");

  ws.on("message", msg=>{
    let data;
    try { data=JSON.parse(msg); } catch { return; }

    const { type, room, payload } = data;
    if(!room) return;

    if(type==="join"){
      if(!rooms.has(room)) rooms.set(room,{ clients:[], players:{} });
      const r = rooms.get(room);
      if(r.clients.length>=2){ ws.send(JSON.stringify({ type:"error", payload:"Room full"})); return; }

      const role = r.clients.length+1;
      ws.role = role;
      ws.room = room;
      r.clients.push(ws);
      r.players[role] = { x: role===1?150:650, y:350, hp:100, punching:false, facing: role===1?1:-1 };

      ws.send(JSON.stringify({ type:"joined", payload:{ role } }));
      console.log(`Client joined room ${room} as role ${role}`);

      if(r.clients.length===2){
        r.clients.forEach(c=>c.send(JSON.stringify({ type:"ready" })));
        console.log(`Room ${room} ready!`);
      }
      return;
    }

    if(type==="input"){
      const r = rooms.get(room);
      if(!r) return;
      const player = r.players[ws.role];
      const otherRole = ws.role===1?2:1;
      const otherPlayer = r.players[otherRole];

      // Apply movement
      if(payload.left) player.x -= 5;
      if(payload.right) player.x += 5;
      player.x = Math.max(0, Math.min(900-80, player.x));
      player.punching = payload.punch && player.punching===false ? true : player.punching;

      if(player.punching && !payload.punch) player.punching=false;

      // Check hits
      const hitbox = getHitbox(player);
      if(hitbox && rectCollision(hitbox, otherPlayer)){
        otherPlayer.hp -= 1;
        console.log(`Player ${ws.role} hit Player ${otherRole}. HP left: ${otherPlayer.hp}`);
      }

      // Broadcast full state to both clients
      r.clients.forEach(c=>{
        if(c.readyState===WebSocket.OPEN){
          c.send(JSON.stringify({ type:"state", payload:r.players }));
        }
      });
    }
  });

  ws.on("close", ()=>{
    console.log("Client disconnected");
    if(!ws.room) return;
    const r = rooms.get(ws.room);
    if(!r) return;
    const idx = r.clients.indexOf(ws);
    if(idx!==-1) r.clients.splice(idx,1);
    if(r.clients.length===0) rooms.delete(ws.room);
    console.log(`Client removed from room ${ws.room}`);
  });

  ws.on("error", err=>console.error("Socket error:", err));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));