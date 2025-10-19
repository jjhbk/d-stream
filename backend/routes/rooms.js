import express from "express";
import Room from "../models/Room.js";
import Track from "../models/Track.js";

const router = express.Router();

// Create a new room
router.post("/", async (req, res) => {
  try {
    const { roomId, creatorAddress, title, description } = req.body;
    const room = await Room.create({
      roomId,
      creatorAddress,
      title,
      description,
    });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Fetch all rooms
router.get("/", async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.json(rooms);
});

// Fetch a specific room by roomId
router.get("/:roomId", async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const tracks = await Track.find({ roomId: req.params.roomId }).sort({
    createdAt: 1,
  });
  res.json({ room, tracks });
});

// Add a track to a room (by creator or participant)
router.post("/:roomId/tracks", async (req, res) => {
  const { title, url, addedBy } = req.body;
  const track = await Track.create({
    roomId: req.params.roomId,
    title,
    url,
    addedBy,
  });
  res.json(track);
});

// Mark track as played (for history)
router.post("/:roomId/played", async (req, res) => {
  const { url } = req.body;
  const track = await Track.findOneAndUpdate(
    { roomId: req.params.roomId, url },
    { playedAt: new Date() },
    { new: true }
  );
  res.json(track);
});

app.post("/api/rooms/:roomId/seek", async (req, res) => {
  try {
    const { time, address } = req.body;
    if (typeof time !== "number" || !address)
      return res.status(400).json({ error: "Invalid payload" });

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });

    // 🔒 Only the creator can update the seek position
    if (room.creatorAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await Room.updateOne(
      { roomId: req.params.roomId },
      { currentSeek: time, lastUpdated: new Date() }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Seek update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
