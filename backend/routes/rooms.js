import express from "express";
import Room from "../models/Room.js";
import Playlist from "../models/Playlist.js";

const router = express.Router();

/**
 * 🎵 Create a new room
 */
router.post("/", async (req, res) => {
  try {
    const { roomId, title, description, creatorAddress } = req.body;
    if (!roomId || !creatorAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let room = await Room.findOne({ roomId });
    if (room) return res.json({ success: true, room });

    room = await Room.create({
      roomId,
      title,
      description,
      creatorAddress,
    });

    res.json({ success: true, room });
  } catch (err) {
    console.error("❌ Error creating room:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 📦 Get room details + playlists
 */
router.get("/:roomId", async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const playlists = await Playlist.find({ roomId: req.params.roomId });
    res.json({ success: true, room, playlists });
  } catch (err) {
    console.error("❌ Error fetching room:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ⏩ Update current seek time (only creator)
 */
router.post("/:roomId/seek", async (req, res) => {
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
    console.error("❌ Seek update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 🎧 Create a playlist
 */
router.post("/:roomId/playlists", async (req, res) => {
  try {
    const { title, description, address } = req.body;
    if (!title || !address)
      return res.status(400).json({ error: "Missing required fields" });

    const playlist = await Playlist.create({
      roomId: req.params.roomId,
      title,
      description,
      createdBy: address,
      tracks: [],
    });

    res.json({ success: true, playlist });
  } catch (err) {
    console.error("❌ Error creating playlist:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 📜 Get all playlists for a room
 */
router.get("/:roomId/playlists", async (req, res) => {
  try {
    const playlists = await Playlist.find({ roomId: req.params.roomId });
    res.json({ success: true, playlists });
  } catch (err) {
    console.error("❌ Error fetching playlists:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ➕ Add track to playlist
 */
router.post("/:roomId/playlists/:playlistId/tracks", async (req, res) => {
  try {
    const { title, url, addedBy } = req.body;
    if (!title || !url || !addedBy)
      return res.status(400).json({ error: "Invalid data" });

    const playlist = await Playlist.findById(req.params.playlistId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    playlist.tracks.push({ title, url, addedBy });
    await playlist.save();

    res.json({ success: true, playlist });
  } catch (err) {
    console.error("❌ Error adding track:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✔ Mark track as played (only creator)
 */
router.post("/:roomId/played", async (req, res) => {
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
    console.error("❌ Error marking as played:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
