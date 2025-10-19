// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { SiweMessage } from "siwe";

// Models
import User from "./models/User.js";
import Room from "./models/Room.js";
import Track from "./models/Track.js";

dotenv.config();

// --- Express setup ---
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- Session setup ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/freejam4u")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* 
  =========================================================
  🪪 AUTH ROUTES (Sign-In With Ethereum)
  =========================================================
*/

// Step 1: Generate nonce
app.get("/auth/nonce", (req, res) => {
  const nonce = Math.random().toString(36).substring(2);
  req.session.nonce = nonce;
  res.json({ nonce });
});

// Step 2: Verify SIWE message + signature
app.post("/auth/verify", async (req, res) => {
  try {
    const { message, signature } = req.body;
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (fields.success && fields.data.nonce === req.session.nonce) {
      const address = siweMessage.address.toLowerCase();

      let user = await User.findOne({ address });
      if (!user) user = await User.create({ address });

      req.session.user = { address };
      res.json({ ok: true, address });
    } else {
      res.status(400).json({ ok: false, error: "Invalid signature or nonce" });
    }
  } catch (err) {
    console.error("❌ SIWE verification failed:", err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Step 3: Fetch logged-in user
app.get("/auth/me", (req, res) => {
  if (req.session.user) res.json(req.session.user);
  else res.status(401).json({ error: "Not logged in" });
});

/* 
  =========================================================
  🎵 ROOM ROUTES
  =========================================================
*/

// Create a new room
app.post("/api/rooms", async (req, res) => {
  try {
    const { roomId, creatorAddress, title, description } = req.body;

    // basic validation
    if (!creatorAddress || !roomId || !title)
      return res.status(400).json({ error: "Missing required fields" });

    const room = await Room.create({
      roomId,
      creatorAddress,
      title,
      description,
    });
    res.json(room);
  } catch (err) {
    console.error("❌ Error creating room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Fetch all rooms
app.get("/api/rooms", async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.json(rooms);
});

// Fetch one room (with tracks)
app.get("/api/rooms/:roomId", async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const tracks = await Track.find({ roomId: req.params.roomId }).sort({
    createdAt: 1,
  });
  res.json({ room, tracks });
});

// Add a track to a room
app.post("/api/rooms/:roomId/tracks", async (req, res) => {
  try {
    const { title, url, addedBy } = req.body;
    if (!title || !url || !addedBy)
      return res.status(400).json({ error: "Missing required fields" });

    const track = await Track.create({
      roomId: req.params.roomId,
      title,
      url,
      addedBy,
    });
    res.json(track);
  } catch (err) {
    console.error("❌ Error adding track:", err);
    res.status(500).json({ error: "Failed to add track" });
  }
});

// Mark track as played
app.post("/api/rooms/:roomId/played", async (req, res) => {
  try {
    const { url } = req.body;
    const track = await Track.findOneAndUpdate(
      { roomId: req.params.roomId, url },
      { playedAt: new Date() },
      { new: true }
    );
    res.json(track);
  } catch (err) {
    console.error("❌ Error marking track played:", err);
    res.status(500).json({ error: "Failed to mark as played" });
  }
});

/* 
  =========================================================
  🌐 WEBSOCKET SERVER (Real-Time Room Sync)
  =========================================================
*/

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const activeRooms = new Map(); // roomId -> Set of WebSocket clients

wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split("?")[1]);
  const roomId = urlParams.get("roomId") || "default";

  if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Set());
  activeRooms.get(roomId).add(ws);

  console.log(`✅ WS connected | Room: ${roomId}`);

  // Send current playback state when user joins
  (async () => {
    const room = await Room.findOne({ roomId });
    if (room?.currentTrack) {
      ws.send(
        JSON.stringify({
          type: "sync-state",
          roomId,
          url: room.currentTrack,
          seek: room.currentSeek,
        })
      );
    }
  })();

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // --- Persist current playback state ---
      if (data.type === "media-change" && data.url) {
        await Room.findOneAndUpdate(
          { roomId },
          {
            currentTrack: data.url,
            currentSeek: 0,
            lastUpdated: new Date(),
          },
          { new: true }
        );
      }

      if (data.type === "seek" && typeof data.time === "number") {
        await Room.findOneAndUpdate(
          { roomId },
          {
            currentSeek: data.time,
            lastUpdated: new Date(),
          }
        );
      }

      // --- Broadcast to all others in room ---
      activeRooms.get(roomId)?.forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("⚠️ Invalid WS message:", err);
    }
  });

  ws.on("close", () => {
    const clients = activeRooms.get(roomId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) activeRooms.delete(roomId);
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req)
    );
  } else {
    socket.destroy();
  }
});

/* 
  =========================================================
  🚀 START SERVER
  =========================================================
*/

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 FreeJam4U server running at http://localhost:${PORT}`);
  console.log(
    `💬 WebSocket endpoint: ws://localhost:${PORT}/ws?roomId=<roomId>`
  );
});
