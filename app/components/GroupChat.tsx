"use client";

import React, { useState, useEffect, useRef } from "react";

interface GroupChatProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
  userId: string;
}

interface ChatMessage {
  id: string;
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

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load nickname from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nickname");
      if (saved) setNickname(saved);
    }
  }, []);

  // 🛰️ Wait until WebSocket becomes available, then attach listener
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current) {
        attachMessageListener(wsRef.current);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [roomId]);

  const attachMessageListener = (ws: WebSocket) => {
    const handleMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "chat" && data.roomId === roomId) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              senderId: data.senderId,
              nickname: data.nickname || "Anonymous",
              message: data.message,
              timestamp: data.timestamp || Date.now(),
            },
          ]);
        }
      } catch (err) {
        console.error("Chat parse error:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    console.log("✅ Chat listener attached for", roomId);

    // cleanup
    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  };

  // 📨 Send chat message
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

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      console.log("📤 Sent message:", msg);
    } else {
      console.warn("⚠️ WebSocket not ready to send message");
    }

    // Optimistic local render
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

  // 🎨 Assign color by sender ID
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

      {/* Chat area */}
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

      {/* Input */}
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
        🪪 You are{" "}
        <span className="text-fuchsia-400 font-mono">{userId.slice(0, 8)}</span>{" "}
        (unique ID)
      </div>
    </div>
  );
}
