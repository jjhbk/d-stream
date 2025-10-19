// models/Room.js
import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true },
  creatorAddress: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  currentTrack: { type: String, default: null }, // URL or ID
  currentSeek: { type: Number, default: 0 }, // fraction (0–1)
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("Room", RoomSchema);
