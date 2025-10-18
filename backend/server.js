import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

// --- Setup Express ---
const app = express();
app.get("/", (req, res) => res.send("🎧 JamRoom WebSocket Server Running"));

// --- Create HTTP server ---
const server = createServer(app);

// --- Create WebSocket server ---
const wss = new WebSocketServer({ noServer: true });

// --- Store rooms ---
const rooms = new Map(); // roomId => Set of ws

// --- Handle connections ---
wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split("?")[1]);
  const roomId = urlParams.get("roomId") || "default";
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);

  console.log(
    `✅ WS connected | Room: ${roomId} | Total clients in room: ${
      rooms.get(roomId).size
    }`
  );

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log(`📨 Message received in room ${roomId}:`, data);

      // Broadcast to all other clients in the same room
      rooms.get(roomId).forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(JSON.stringify(data));
          console.log(`📤 Broadcasted to client in room ${roomId}:`, data);
        }
      });
    } catch (err) {
      console.error("⚠️ Invalid WS message", err);
    }
  });

  ws.on("close", () => {
    rooms.get(roomId).delete(ws);
    console.log(
      `❌ WS disconnected | Room: ${roomId} | Remaining clients: ${
        rooms.get(roomId).size
      }`
    );
    if (rooms.get(roomId).size === 0) rooms.delete(roomId);
  });
});

// --- Upgrade HTTP -> WS ---
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req)
    );
  } else {
    socket.destroy();
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 JamRoom WS server running at http://0.0.0.0:${PORT}`);
  console.log(`Use ws://localhost:${PORT}/ws?roomId=<roomId> in your client`);
});
