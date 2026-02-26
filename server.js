const WebSocket = require("ws");
const http = require("http");

// ======================
// HTTP SERVER (for status)
// ======================
const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "Server running" }));
      return;
    }
    if (req.url === "/status") {
      let roomCount = rooms.size;
      let clientCount = 0;
      rooms.forEach(clients => clientCount += clients.size);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rooms: roomCount, clients: clientCount }));
      return;
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

// ======================
// WEBSOCKET SERVER
// ======================
const wss = new WebSocket.Server({ server });
const rooms = new Map();

// ======================
// CONSTANTS
// ======================
const CANVAS_WIDTH = 900;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 120;
const MOVE_SPEED = 5;
const PUNCH_RANGE = 50;
const MAX_HP = 100;

// ======================
// PLAYER STATE TEMPLATE
// ======================
function createPlayer(role){
  return {
    x: role === 1 ? 150 : 650,
    y: 350,
    hp: MAX_HP,
    role,
    punching: false,
    facing: role === 1 ? 1 : -1
  };
}

// ======================
// HANDLE CONNECTION
// ======================
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } 
    catch { return; }

    const { type, room, payload } = data;
    if(!room) {
      ws.send(JSON.stringify({type:"error", payload:"Room ID required"}));
      return;
    }

    if(!rooms.has(room)) rooms.set(room, new Map());
    const clients = rooms.get(room);

    // Add player to room
    if(!clients.has(ws)){
      if(clients.size >= 2){
        ws.send(JSON.stringify({type:"error", payload:"Room full"}));
        return;
      }
      const role = clients.size + 1;
      clients.set(ws, createPlayer(role));
      ws.send(JSON.stringify({type:"joined", payload:{role}}));

      if(clients.size === 2){
        // Notify both players ready
        clients.forEach((playerWs) => {
          playerWs.send(JSON.stringify({type:"ready"}));
        });
      }
    }

    const player = clients.get(ws);
    const opponent = Array.from(clients.values()).find(p => p !== player);

    // ======================
    // HANDLE INPUT
    // ======================
    if(type === "input" && payload){
      // Movement
      if(payload.left) player.x -= MOVE_SPEED;
      if(payload.right) player.x += MOVE_SPEED;

      // Clamp positions
      player.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, player.x));

      // Facing
      if(opponent){
        player.facing = player.x < opponent.x ? 1 : -1;
      }

      // Punch
      player.punching = payload.punch;

      // Hit detection
      if(player.punching && opponent){
        const distance = Math.abs((player.x + (player.facing === 1 ? PLAYER_WIDTH : 0)) - (opponent.x + PLAYER_WIDTH/2));
        if(distance <= PUNCH_RANGE){
          opponent.hp = Math.max(0, opponent.hp - 1); // damage 1 per hit
          console.log(`💥 Player ${player.role} hit Player ${opponent.role} | HP: ${opponent.hp}`);
        }
      }

      // Broadcast updated state
      const state = {};
      clients.forEach((p, cws)=>state[p.role] = {...p});
      clients.forEach(cws=>{
        if(cws.readyState === WebSocket.OPEN){
          cws.send(JSON.stringify({type:"state", payload:state}));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    rooms.forEach((clients, roomId) => {
      clients.delete(ws);
      if(clients.size === 0) rooms.delete(roomId);
    });
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Boxing server running on port ${PORT}`));