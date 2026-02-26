const WebSocket = require("ws");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Boxing WebSocket Server Running");
});

const wss = new WebSocket.Server({ server });

/*
Room Structure:
rooms = {
  roomId: {
    clients: [ws1, ws2],
    players: {
      1: { x, y, hp, punching, facing },
      2: { x, y, hp, punching, facing }
    }
  }
}
*/
const rooms = new Map();

const CANVAS_WIDTH = 900;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 120;

function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      console.log("Invalid JSON received");
      return;
    }

    const { type, room, payload } = data;
    if (!room) return;

    // =========================
    // JOIN ROOM
    // =========================
    if (type === "join") {
      if (!rooms.has(room)) {
        rooms.set(room, {
          clients: [],
          players: {}
        });
      }

      const r = rooms.get(room);

      if (r.clients.length >= 2) {
        ws.send(JSON.stringify({ type: "error", payload: "Room full" }));
        return;
      }

      const role = r.clients.length + 1;
      ws.role = role;
      ws.room = room;

      r.clients.push(ws);

      r.players[role] = {
        x: role === 1 ? 150 : 650,
        y: 350,
        hp: 100,
        punching: false,
        facing: role === 1 ? 1 : -1
      };

      ws.send(JSON.stringify({
        type: "joined",
        payload: { role }
      }));

      console.log(`Player ${role} joined room ${room}`);

      if (r.clients.length === 2) {
        r.clients.forEach(c =>
          c.send(JSON.stringify({ type: "ready" }))
        );
        console.log(`Room ${room} ready`);
      }

      return;
    }

    if(data.type==="state"){
      players = data.payload;
    
      if(!gameOver && players[1] && players[2]){
    
        if(players[1].hp <= 0 || players[2].hp <= 0){
          gameOver = true;
    
          let winner;
    
          if(players[1].hp <= 0){
            winner = 2;
          } else {
            winner = 1;
          }
    
          console.log("🏆 Winner is Player", winner);
    
          if(myRole === winner){
            winSound.play();
          } else {
            loseSound.play();
          }
        }
      }
    }

    // =========================
    // INPUT HANDLING
    // =========================
    if (type === "input") {
      const r = rooms.get(room);
      if (!r) return;

      const player = r.players[ws.role];
      const opponentRole = ws.role === 1 ? 2 : 1;
      const opponent = r.players[opponentRole];

      if (!player || !opponent) return;

      // ----- MOVEMENT -----
      if (payload.left) player.x -= 5;
      if (payload.right) player.x += 5;

      // Clamp inside canvas
      player.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, player.x));

      // ----- PUNCH STATE -----
      player.punching = payload.punch ? true : false;

      // ----- HIT DETECTION -----
      if (player.punching) {

        const hitbox = player.facing === 1
          ? {
              x: player.x + PLAYER_WIDTH,
              y: player.y + 40,
              width: 40,
              height: 20
            }
          : {
              x: player.x - 40,
              y: player.y + 40,
              width: 40,
              height: 20
            };

        const opponentBody = {
          x: opponent.x,
          y: opponent.y,
          width: PLAYER_WIDTH,
          height: PLAYER_HEIGHT
        };

        if (checkCollision(hitbox, opponentBody)) {
          opponent.hp -= 1;

          if (opponent.hp < 0) opponent.hp = 0;

          console.log(
            `💥 Player ${ws.role} hit Player ${opponentRole} | HP: ${opponent.hp}`
          );
        }
      }

      // ----- BROADCAST FULL STATE -----
      r.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "state",
            payload: r.players
          }));
        }
      });

      console.log(
        `State Broadcast -> P1 HP: ${r.players[1]?.hp} | P2 HP: ${r.players[2]?.hp}`
      );

      return;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    if (!ws.room) return;

    const r = rooms.get(ws.room);
    if (!r) return;

    r.clients = r.clients.filter(c => c !== ws);

    if (r.clients.length === 0) {
      rooms.delete(ws.room);
      console.log(`Room ${ws.room} deleted`);
    }
  });

  ws.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`🔥 Boxing Server running on port ${PORT}`)
);