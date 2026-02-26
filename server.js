const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomId -> { clients: [], state }

wss.on("connection", ws => {
  console.log("Client connected");

  ws.on("message", message => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    const { type, room, payload } = data;
    if (!room) return ws.send(JSON.stringify({ type:"error", payload:"Room ID required" }));

    // Create room if missing
    if (!rooms.has(room)) {
      rooms.set(room, {
        clients: [],
        state: {
          1: { x:150, y:350, hp:100, facing:1, punching:false },
          2: { x:650, y:350, hp:100, facing:-1, punching:false },
          score: {1:0, 2:0},
          round: 1
        }
      });
    }

    const roomObj = rooms.get(room);

    // Add client to room
    if(!roomObj.clients.includes(ws) && roomObj.clients.length < 2){
      roomObj.clients.push(ws);
      const role = roomObj.clients.indexOf(ws) + 1;
      ws.send(JSON.stringify({ type:"joined", payload:{ role } }));

      // If 2 players, notify ready
      if(roomObj.clients.length === 2){
        roomObj.clients.forEach(c => c.send(JSON.stringify({ type:"ready" })));
      }
    }

    // Handle player input
    if(type === "input"){
      const playerId = roomObj.clients.indexOf(ws) + 1;
      if(playerId === 0) return; // unknown player
      const p = roomObj.state[playerId];
      const otherId = playerId === 1 ? 2 : 1;
      const other = roomObj.state[otherId];

      // Movement
      if(payload.left) p.x -= 5;
      if(payload.right) p.x += 5;

      // Punch
      if(payload.punch) {
        p.punching = true;

        // Check hit
        const hitRange = 80;
        if(p.facing === 1 && p.x + 80 >= other.x && p.x + 80 <= other.x + 80) {
          other.hp = Math.max(0, other.hp-1);
        } else if(p.facing === -1 && p.x <= other.x + 80 && p.x >= other.x) {
          other.hp = Math.max(0, other.hp-1);
        }
      } else p.punching = false;

      // Update facing
      roomObj.state[1].facing = roomObj.state[1].x < roomObj.state[2].x ? 1 : -1;
      roomObj.state[2].facing = roomObj.state[2].x < roomObj.state[1].x ? 1 : -1;

      // Check round over
      if(roomObj.state[1].hp === 0 || roomObj.state[2].hp === 0){
        const winner = roomObj.state[1].hp === 0 ? 2 : 1;
        roomObj.state.score[winner]++;
        roomObj.state.round++;

        // Reset positions and HP if match not over
        if(roomObj.state.score[1] < 2 && roomObj.state.score[2] < 2){
          roomObj.state[1].hp = 100; roomObj.state[1].x = 150; roomObj.state[1].punching=false;
          roomObj.state[2].hp = 100; roomObj.state[2].x = 650; roomObj.state[2].punching=false;
        }
      }
    }

    // Broadcast state
    const stateMsg = JSON.stringify({ type:"state", payload:roomObj.state });
    roomObj.clients.forEach(c => {
      if(c.readyState === WebSocket.OPEN) c.send(stateMsg);
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    rooms.forEach((roomObj, roomId) => {
      roomObj.clients = roomObj.clients.filter(c => c !== ws);
      if(roomObj.clients.length === 0) rooms.delete(roomId);
    });
  });
});

server.listen(process.env.PORT || 8080, () => console.log("Server running"));