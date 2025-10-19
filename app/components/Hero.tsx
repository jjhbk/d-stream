"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";

export default function HeroSection() {
  const [roomId, setRoomId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://freejam4u.onrender.com";

  const generateRoomId = (length = 10) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    alert("Room URL copied to clipboard!");
  };

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);

      if (!window.ethereum) {
        alert("Please install MetaMask");
        setIsCreating(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const newRoomId = generateRoomId();
      const title =
        prompt("Enter a title for your stream:", "My DStream Room") ||
        "Untitled Stream";

      const response = await fetch(`${API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: newRoomId,
          creatorAddress: address,
          title,
        }),
      });

      const data = await response.json();
      const createdRoomId = data.room?.roomId;
      if (!createdRoomId) throw new Error("Room ID missing in response");

      const url = `${window.location.origin}/jam/${encodeURIComponent(
        createdRoomId
      )}`;
      setRoomId(createdRoomId);
      setShareUrl(url);

      alert(`✅ Stream "${title}" created successfully!`);
    } catch (err) {
      console.error("Error creating room:", err);
      alert("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = () => {
    if (!roomId.trim()) return alert("Enter a room ID");
    router.push(`/jam/${encodeURIComponent(roomId.trim())}`);
  };

  return (
    <section className="relative h-[100vh] flex flex-col justify-center items-center text-center overflow-hidden bg-black">
      {/* 🔮 Cinematic Video Background */}
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-25"
        >
          <source src="/cinematic-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
      </div>

      {/* 🌈 Ambient Blurs */}
      <div className="absolute top-[-8rem] left-[10%] w-[25rem] h-[25rem] bg-fuchsia-600/40 rounded-full blur-3xl opacity-40 animate-pulse" />
      <div className="absolute bottom-[-8rem] right-[10%] w-[25rem] h-[25rem] bg-indigo-600/40 rounded-full blur-3xl opacity-40 animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_0%,_transparent_80%)]" />

      {/* 🎬 Hero Text */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
        className="relative z-10 px-6 flex flex-col items-center"
      >
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.3)] leading-tight">
          DStream Platform
        </h1>

        <p className="mt-6 text-gray-300 text-lg md:text-2xl max-w-2xl mx-auto leading-relaxed backdrop-blur-sm bg-black/10 px-4 py-2 rounded-xl shadow-inner">
          The world’s first decentralized streaming platform — create rooms,
          stream music or movies, and own your content with crypto.
        </p>

        {/* 🧱 Embedded Room Creator (replaces FreeJam4U card) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-10 w-full max-w-xl bg-gray-900/90 backdrop-blur-xl text-white p-6 rounded-2xl shadow-2xl border border-gray-800"
        >
          <h2 className="text-3xl font-bold mb-4 text-fuchsia-400">
            🎥 Start Streaming
          </h2>
          <p className="text-gray-400 mb-6 text-center">
            Join an existing stream or create your own decentralized jam room.
          </p>

          {/* Join */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto mb-4">
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleJoin}
              className="px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-semibold"
            >
              Join Room
            </button>
          </div>

          {/* Create */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto mb-4">
            <button
              disabled={isCreating}
              onClick={handleCreateRoom}
              className={`flex-1 px-5 py-3 rounded-lg font-semibold transition ${
                isCreating ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isCreating ? "Creating..." : "Create New Room"}
            </button>

            {shareUrl && (
              <button
                onClick={copyToClipboard}
                className="px-5 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 font-semibold transition"
              >
                Copy URL
              </button>
            )}
          </div>

          {shareUrl && (
            <p className="text-gray-300 text-sm break-all text-center">
              Share your stream:{" "}
              <span className="font-mono text-yellow-400">{shareUrl}</span>
            </p>
          )}

          <p className="mt-6 text-gray-500 text-sm text-center">
            Rooms are decentralized and persisted — invite your friends or fans
            to join.
          </p>
        </motion.div>
      </motion.div>

      {/* ✨ Floating Motion Lights */}
      <motion.div
        className="absolute top-[20%] left-[15%] w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"
        animate={{
          y: [0, 25, 0],
          scale: [1, 1.05, 1],
          transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[15%] w-52 h-52 bg-pink-500/20 rounded-full blur-3xl"
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
          transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </section>
  );
}
