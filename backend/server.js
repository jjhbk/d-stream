import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===========================================================
// 🧠 MongoDB Setup
// ===========================================================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/freejam4u", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ===========================================================
// 🎵 Schemas
// ===========================================================

// Room
const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  title: { type: String },
  description: { type: String },
  creatorAddress: { type: String, required: true },
  currentTrack: { type: String, default: null },
  currentSeek: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", roomSchema);

// Playlist
const playlistSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  createdBy: { type: String, required: true },
  tracks: [
    {
      title: String,
      url: String,
      addedBy: String,
      playedAt: { type: Date, default: null },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const Playlist = mongoose.model("Playlist", playlistSchema);

// ===========================================================
// 🔌 REST API Routes
// ===========================================================

// Health check
app.get("/", (req, res) => {
  res.send("🎧 FreeJam4U API running");
});

// 🧠 Create Room
app.post("/api/rooms", async (req, res) => {
  try {
    const { roomId, title, description, creatorAddress } = req.body;
    if (!roomId || !creatorAddress)
      return res.status(400).json({ error: "Missing required fields" });

    let room = await Room.findOne({ roomId });
    if (room) return res.json({ room });

    room = await Room.create({
      roomId,
      title,
      description,
      creatorAddress,
    });

    res.json({ success: true, room });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🎵 Get Room Data
app.get("/api/rooms/:roomId", async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });
    const playlists = await Playlist.find({ roomId: req.params.roomId });
    res.json({ success: true, room, playlists });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 💾 Update Seek (Only Creator)
app.post("/api/rooms/:roomId/seek", async (req, res) => {
  try {
    const { time, address } = req.body;
    if (typeof time !== "number" || !address)
      return res.status(400).json({ error: "Invalid payload" });

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.creatorAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    room.currentSeek = time;
    await room.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Seek update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🧩 Playlist Endpoints

// Create Playlist
app.post("/api/rooms/:roomId/playlists", async (req, res) => {
  try {
    const { title, description, address } = req.body;
    if (!title || !address)
      return res.status(400).json({ error: "Missing fields" });

    const playlist = await Playlist.create({
      roomId: req.params.roomId,
      title,
      description,
      createdBy: address,
      tracks: [],
    });

    res.json({ success: true, playlist });
  } catch (err) {
    console.error("Error creating playlist:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get All Playlists for Room
app.get("/api/rooms/:roomId/playlists", async (req, res) => {
  try {
    const playlists = await Playlist.find({ roomId: req.params.roomId });
    res.json({ success: true, playlists });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add Track to Playlist
app.post(
  "/api/rooms/:roomId/playlists/:playlistId/tracks",
  async (req, res) => {
    try {
      const { title, url, addedBy } = req.body;
      if (!title || !url || !addedBy)
        return res.status(400).json({ error: "Invalid data" });

      const playlist = await Playlist.findById(req.params.playlistId);
      if (!playlist)
        return res.status(404).json({ error: "Playlist not found" });

      playlist.tracks.push({ title, url, addedBy });
      await playlist.save();

      res.json({ success: true, playlist });
    } catch (err) {
      console.error("Error adding track:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Mark Track as Played
app.post("/api/rooms/:roomId/played", async (req, res) => {
  try {
    const { url, address } = req.body;
    if (!url || !address)
      return res.status(400).json({ error: "Missing data" });

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.creatorAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await Playlist.updateOne(
      { roomId: req.params.roomId, "tracks.url": url },
      { $set: { "tracks.$.playedAt": new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking as played:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===========================================================
// 🌐 WebSocket Server for Real-time Sync
// ===========================================================

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const rooms = new Map(); // roomId => Set of clients

wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split("?")[1]);
  const roomId = urlParams.get("roomId") || "default";

  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);

  console.log(
    `✅ WS connected: Room ${roomId} (${rooms.get(roomId).size} users)`
  );

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      switch (data.type) {
        case "join": {
          // send current room state (if exists)
          const room = await Room.findOne({ roomId });
          if (room?.currentTrack) {
            ws.send(
              JSON.stringify({
                type: "media-change",
                roomId,
                url: room.currentTrack,
              })
            );
            ws.send(
              JSON.stringify({
                type: "seek",
                roomId,
                time: room.currentSeek || 0,
              })
            );
          }
          break;
        }

        case "media-change": {
          await Room.updateOne({ roomId }, { currentTrack: data.url });
          break;
        }

        case "seek": {
          const room = await Room.findOne({ roomId });
          if (
            room &&
            data.address?.toLowerCase() === room.creatorAddress.toLowerCase()
          ) {
            await Room.updateOne({ roomId }, { currentSeek: data.time });
          }
          break;
        }
      }

      // Broadcast message to other clients in the room
      rooms.get(roomId)?.forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("⚠️ Invalid WS message", err);
    }
  });

  ws.on("close", () => {
    rooms.get(roomId)?.delete(ws);
    console.log(`❌ WS disconnected | Room: ${roomId}`);
    if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
  });
});

// Upgrade HTTP → WebSocket
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ===========================================================
// 🚀 Start Server
// ===========================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
