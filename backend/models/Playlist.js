import mongoose from "mongoose";

const PlaylistSchema = new mongoose.Schema({
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

export default mongoose.model("Playlist", PlaylistSchema);
