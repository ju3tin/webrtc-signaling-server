const WebSocket = require("ws");
const http = require("http");

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(JSON.stringify({
        websocketstatus: 'working',
        greeting: 'hello world'
      }));
      return;
    }

    if (req.url === "/status") {
      // Calculate number of rooms
      const roomCount = rooms.size;

      // Calculate total connected clients
      let clientCount = 0;
      rooms.forEach((clients) => {
        clientCount += clients.size;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        rooms: roomCount,
        clients: clientCount
      }));
      return;
    }
  }

  // Any other path → 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// WebSocket server using the same HTTP server
const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    const { room, type, payload } = data;

    if (!room) {
      ws.send(JSON.stringify({ type: "error", payload: "Room ID required" }));
      return;
    }

    // Create room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }

    const clients = rooms.get(room);

    // 🚫 Enforce 2-user limit
    if (!clients.has(ws) && clients.size >= 2) {
      ws.send(JSON.stringify({
        type: "error",
        payload: "Room is full (2 users max)"
      }));
      return;
    }

    // Add client to room if not already in
    if (!clients.has(ws)) {
      clients.add(ws);
      ws.room = room;

      ws.send(JSON.stringify({
        type: "joined",
        payload: { room }
      }));
    }

    // Relay message to other client in room
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, payload }));
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    const room = ws.room;
    if (!room) return;

    const clients = rooms.get(room);
    if (!clients) return;

    clients.delete(ws);

    if (clients.size === 0) {
      rooms.delete(room);
    }
  });
});
// Listen on port
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));