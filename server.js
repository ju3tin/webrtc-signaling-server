const WebSocket = require("ws");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket Boxing Server");
});

const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomId -> { clients: Set, state }

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    const { type, room, payload } = data;
    if (!room) return ws.send(JSON.stringify({type:"error", payload:"Room ID required"}));

    if (!rooms.has(room)) {
      rooms.set(room, {
        clients: new Set(),
        state: {
          1: { x:150, y:350, hp:100, facing:1, punching:false },
          2: { x:650, y:350, hp:100, facing:-1, punching:false },
          round: 1,
          score: {1:0,2:0},
        }
      });
    }

    const roomObj = rooms.get(room);
    roomObj.clients.add(ws);

    // Handle input
    if(type === "input" && roomObj.clients.size <= 2){
      const playerId = ws === Array.from(roomObj.clients)[0] ? 1 : 2;
      const p = roomObj.state[playerId];

      // Move left/right
      if(payload.left) p.x -= 5;
      if(payload.right) p.x += 5;

      // Punch
      if(payload.punch) {
        p.punching = true;

        // Check hit
        const otherId = playerId === 1 ? 2 : 1;
        const other = roomObj.state[otherId];

        const hitRange = 80;
        if(playerId===1 && p.facing===1 && p.x + 80 >= other.x && p.x + 80 <= other.x + 80) {
          other.hp = Math.max(0, other.hp-1);
        }
        if(playerId===2 && p.facing===-1 && p.x <= other.x+80 && p.x >= other.x) {
          other.hp = Math.max(0, other.hp-1);
        }
      } else {
        p.punching = false;
      }

      // Update facing
      const p1 = roomObj.state[1];
      const p2 = roomObj.state[2];
      p1.facing = p1.x < p2.x ? 1 : -1;
      p2.facing = p2.x < p1.x ? 1 : -1;

      // Round reset
      if(p1.hp === 0 || p2.hp === 0){
        const winner = p1.hp === 0 ? 2 : 1;
        roomObj.state.score[winner]++;
        roomObj.state.round++;

        // Reset positions & HP for next round if match not over
        if(roomObj.state.score[1] < 2 && roomObj.state.score[2] < 2){
          p1.x = 150; p1.hp = 100;
          p2.x = 650; p2.hp = 100;
          console.log(`Round ${roomObj.state.round} starts, players reset`);
        }
      }
    }

    // Broadcast state
    const statePayload = { type:"state", payload:roomObj.state };
    roomObj.clients.forEach(c=>{
      if(c.readyState === WebSocket.OPEN) c.send(JSON.stringify(statePayload));
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    rooms.forEach((roomObj, roomId)=>{
      roomObj.clients.delete(ws);
      if(roomObj.clients.size===0) rooms.delete(roomId);
    });
  });
});

server.listen(process.env.PORT || 8080, ()=>console.log("Server running"));