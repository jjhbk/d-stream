let ws = null;
let connectedRoomId = null;
const WS_URL = "wss://freejam4u.onrender.com/ws";

// Open or reconnect to WebSocket
function connectWebSocket(roomId) {
  if (!roomId) return;
  connectedRoomId = roomId;

  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[JamRoom] WS connected");
    ws.send(JSON.stringify({ type: "join", roomId }));
  };

  ws.onclose = () => {
    console.warn("[JamRoom] WS disconnected, retrying...");
    setTimeout(() => connectWebSocket(roomId), 3000);
  };

  ws.onerror = (err) => console.error("[JamRoom] WS error", err);
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "set-room") {
    connectWebSocket(msg.roomId);
    await chrome.storage.sync.set({ roomId: msg.roomId });
    sendResponse({ success: true });
  }

  if (msg.type === "video-changed") {
    const { newUrl } = msg;
    const { roomId } = await chrome.storage.sync.get("roomId");
    if (!roomId || !ws || ws.readyState !== WebSocket.OPEN) return;

    console.log("[JamRoom] Broadcasting new video:", newUrl);
    ws.send(JSON.stringify({ type: "media-change", roomId, url: newUrl }));
  }
});
