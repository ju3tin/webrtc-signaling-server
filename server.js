const WebSocket = require("ws");
const http = require("http");

// Optional HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server running");
});

const wss = new WebSocket.Server({ server });

// roomId => array of clients
const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } 
    catch { console.warn("Invalid JSON:", msg); return; }

    const { type, room, payload } = data;
    if (!room) {
      ws.send(JSON.stringify({ type:"error", payload:"Room ID required"}));
      return;
    }

    // JOIN ROOM
    if (type === "join") {
      if (!rooms.has(room)) rooms.set(room, []);
      const clients = rooms.get(room);

      if (clients.length >= 2) {
        ws.send(JSON.stringify({ type:"error", payload:"Room full"}));
        console.log(`Room ${room} is full`);
        return;
      }

      const role = clients.length + 1;
      ws.role = role;
      ws.room = room;
      clients.push(ws);

      ws.send(JSON.stringify({ type:"joined", payload:{ room, role } }));
      console.log(`Client joined room ${room} as role ${role}`);

      if (clients.length === 2) {
        clients.forEach(c => c.send(JSON.stringify({ type:"ready" })));
        console.log(`Room ${room} ready! Game can start`);
      }
      return;
    }

    // RELAY INPUTS
    if (type === "input") {
      const clients = rooms.get(room);
      if (!clients) return;

      clients.forEach(c => {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify({ type:"input", payload }));
        }
      });
      console.log(`Input relayed from role ${ws.role} in room ${room}:`, payload);
      return;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (!ws.room) return;

    const clients = rooms.get(ws.room);
    if (!clients) return;

    const index = clients.indexOf(ws);
    if (index !== -1) clients.splice(index, 1);

    if (clients.length === 0) rooms.delete(ws.room);
    console.log(`Client removed from room ${ws.room}`);
  });

  ws.on("error", (err) => console.error("Socket error:", err));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`WebSocket server running on port ${PORT}`));