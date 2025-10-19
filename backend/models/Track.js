import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  addedBy: { type: String, required: true }, // wallet address
  playedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Track", TrackSchema);
