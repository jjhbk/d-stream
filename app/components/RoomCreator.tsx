"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";

interface RoomCreatorProps {
  apiUrl?: string; // optional prop if backend URL differs
}

export default function RoomCreator({ apiUrl }: RoomCreatorProps) {
  const [roomId, setRoomId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const API_URL =
    apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Generate random alphanumeric ID
  const generateRoomId = (length = 12) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Create a room via backend
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
        prompt("Enter a title for your room:", "My Jam Room") ||
        "Untitled Room";

      const response = await fetch(`${API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: newRoomId,
          creatorAddress: address,
          title,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      const data = await response.json();
      const url = `${window.location.origin}/jam/${encodeURIComponent(
        data.roomId
      )}`;
      setRoomId(data.roomId);
      setShareUrl(url);

      alert("✅ Room created successfully!");
    } catch (err) {
      console.error("Error creating room:", err);
      alert("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  // Join existing room
  const handleJoin = () => {
    if (!roomId.trim()) return alert("Enter a room ID");
    router.push(`/jam/${encodeURIComponent(roomId.trim())}`);
  };

  // Copy share URL
  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("✅ Room URL copied!");
    });
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-900 text-white p-6 rounded-xl shadow-lg w-full max-w-lg">
      <h1 className="text-4xl font-bold mb-6">🎵 FreeJam4U</h1>
      <p className="text-gray-400 mb-6 text-center max-w-md">
        Enter a room ID to join, or create a new jam room and share the link
        with others.
      </p>

      {/* Join Section */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mb-4">
        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="flex-1 p-3 rounded bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleJoin}
          className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 transition"
        >
          Join Room
        </button>
      </div>

      {/* Create Section */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mb-4">
        <button
          disabled={isCreating}
          onClick={handleCreateRoom}
          className={`flex-1 px-4 py-3 rounded ${
            isCreating ? "bg-gray-500" : "bg-green-600 hover:bg-green-700"
          } transition`}
        >
          {isCreating ? "Creating..." : "Create New Room"}
        </button>

        {shareUrl && (
          <button
            onClick={copyToClipboard}
            className="px-4 py-3 rounded bg-yellow-600 hover:bg-yellow-700 transition"
          >
            Copy URL
          </button>
        )}
      </div>

      {/* Share Link */}
      {shareUrl && (
        <p className="text-gray-300 text-sm break-all text-center">
          Share this room URL:{" "}
          <span className="font-mono text-yellow-400">{shareUrl}</span>
        </p>
      )}

      <p className="mt-6 text-gray-500 text-sm max-w-md text-center">
        Rooms are saved in the database. Anyone with the link can join your jam
        session!
      </p>
    </div>
  );
}
