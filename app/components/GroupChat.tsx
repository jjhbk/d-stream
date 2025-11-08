"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

interface GroupChatProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
  userId: string;
}

interface ChatMessage {
  id: string; // message id
  senderId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export default function GroupChat({ wsRef, roomId, userId }: GroupChatProps) {
  const [nickname, setNickname] = useState<string>("");

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 🧠 Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("nickname");
      if (savedName) setNickname(savedName);
    }
  }, []);

  // 🛰️ Listen for incoming chat messages
  useEffect(() => {
    if (!wsRef.current) return;

    const ws = wsRef.current;
    const handleMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "chat" && data.roomId === roomId) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              senderId: data.senderId || "unknown",
              nickname: data.nickname || "Anonymous",
              message: data.message,
              timestamp: data.timestamp || Date.now(),
            },
          ]);
        }
      } catch (err) {
        console.error("Chat message error:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [wsRef.current, roomId]);

  // 📨 Send message via WebSocket
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;

    const msg = {
      type: "chat",
      roomId,
      senderId: userId,
      nickname: nickname || "Anonymous",
      message: chatInput.trim(),
      timestamp: Date.now(),
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }

    // Show message immediately for sender
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        senderId: userId,
        nickname: msg.nickname,
        message: msg.message,
        timestamp: msg.timestamp,
      },
    ]);

    setChatInput("");
  };

  // 🎨 Utility: assign user color by UUID hash
  const getUserColor = (senderId: string) => {
    const hash = senderId
      .split("")
      .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  return (
    <div className="w-full max-w-4xl bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_0_40px_rgba(88,28,135,0.3)] mt-10 border border-gray-800">
      <h2 className="text-2xl font-bold text-fuchsia-400 mb-4">
        💬 Group Chat
      </h2>

      {/* Nickname input */}
      <div className="flex gap-2 items-center mb-4">
        <input
          type="text"
          placeholder="Enter your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onBlur={() => localStorage.setItem("nickname", nickname)}
          className="flex-1 bg-gray-800 p-2 rounded text-white border border-gray-700 focus:ring-2 focus:ring-fuchsia-500"
        />
        <span className="text-xs text-gray-400">Visible to everyone</span>
      </div>

      {/* Messages */}
      <div className="flex flex-col h-[300px] overflow-y-auto bg-gray-800/60 rounded-lg p-4 border border-gray-700 mb-4 space-y-2">
        {chatMessages.map((m) => (
          <div
            key={m.id}
            className={`text-sm ${
              m.senderId === userId ? "text-right" : "text-left"
            }`}
          >
            <div>
              <span
                style={{ color: getUserColor(m.senderId) }}
                className="font-semibold"
              >
                {m.nickname}
              </span>
              <span className="text-gray-300">: {m.message}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(m.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input box */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
          className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={sendChatMessage}
          className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg font-semibold"
        >
          Send
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-3 text-center">
        🪪 You are <span className="text-fuchsia-400">{userId.slice(0, 8)}</span>{" "}
        (your unique ID, stored locally)
      </div>
    </div>
  );
}
