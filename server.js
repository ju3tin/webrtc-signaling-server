const WebSocket = require("ws");
const http = require("http");

// Create HTTP server (optional, can serve static files if needed)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server running");
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Rooms: Map roomId => Array of clients
const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("Invalid JSON:", message);
      return;
    }

    const { type, room, payload } = data;

    if (!room) {
      ws.send(JSON.stringify({ type: "error", payload: "Room ID required" }));
      return;
    }

    // CREATE / JOIN ROOM
    if (type === "join") {
      if (!rooms.has(room)) rooms.set(room, []);

      const clients = rooms.get(room);

      if (clients.length >= 2) {
        ws.send(JSON.stringify({ type: "error", payload: "Room full (2 players max)" }));
        return;
      }

      // Assign role: first client = 1, second = 2
      const role = clients.length + 1;
      ws.role = role;
      clients.push(ws);

      console.log(`Client joined room ${room} as role ${role}`);

      // Tell this client its role
      ws.send(JSON.stringify({ type: "joined", payload: { room, role } }));

      // If room has 2 clients now, notify both they are ready
      if (clients.length === 2) {
        clients.forEach(c => c.send(JSON.stringify({ type: "ready" })));
        console.log(`Room ${room} ready! Game can start`);
      }

      return;
    }

    // RELAY INPUTS
    if (type === "input") {
      const clients = rooms.get(room);
      if (!clients) return;

      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "input", payload }));
        }
      });
      return;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    // Remove client from any room
    for (const [roomId, clients] of rooms.entries()) {
      const index = clients.indexOf(ws);
      if (index !== -1) {
        clients.splice(index, 1);
        console.log(`Removed client from room ${roomId}`);
        // If room is empty, delete it
        if (clients.length === 0) rooms.delete(roomId);
      }
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

// Listen on port
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`WebSocket server running on port ${PORT}`));