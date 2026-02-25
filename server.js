const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
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

    if (!rooms.has(room)) rooms.set(room, new Set());

    rooms.get(room).add(ws);

    // Relay to other clients in room
    rooms.get(room).forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, payload }));
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    rooms.forEach((clients, room) => {
      clients.delete(ws);
      if (clients.size === 0) rooms.delete(room);
    });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));