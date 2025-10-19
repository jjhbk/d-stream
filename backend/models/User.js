import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  address: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", UserSchema);
