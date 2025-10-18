const JAM_BASE = "https://freejam4u.com/jam"; // or your deployed URL
const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const sendLinkBtn = document.getElementById("sendCurrentLink");
const roomInput = document.getElementById("roomLinkInput");
const roomDisplay = document.getElementById("currentRoomDisplay");

// --- Save and retrieve Room ID ---
async function saveRoomId(roomId) {
  await chrome.storage.sync.set({ roomId });
  roomDisplay.innerHTML = `Room: <a href="${JAM_BASE}/${roomId}" target="_blank">${roomId}</a>`;
}

async function getSavedRoomId() {
  const { roomId } = await chrome.storage.sync.get("roomId");
  return roomId;
}

// --- Send room ID to background WebSocket manager ---
async function sendRoomToBackground(roomId) {
  await chrome.runtime.sendMessage({ type: "set-room", roomId });
}

// --- Get current tab URL ---
async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

function extractRoomId(link) {
  try {
    const url = new URL(link);
    const parts = url.pathname.split("/");
    return parts.pop() || parts.pop(); // handles trailing slash
  } catch {
    return null;
  }
}

// --- Create New Jam Room ---
createRoomBtn.addEventListener("click", async () => {
  const newRoomId = Math.random().toString(36).slice(2, 10);
  await saveRoomId(newRoomId); // ✅ Save locally
  await sendRoomToBackground(newRoomId); // ✅ Tell background
  const url = `${JAM_BASE}/${newRoomId}`;
  chrome.tabs.create({ url });
});

// --- Join Existing Room ---
joinRoomBtn.addEventListener("click", async () => {
  const input = roomInput.value.trim();
  if (!input) return alert("Please paste a room link or ID");

  const roomId = extractRoomId(input) || input;
  await saveRoomId(roomId); // ✅ Save locally
  await sendRoomToBackground(roomId); // ✅ Tell background
  const url = `${JAM_BASE}/${roomId}`;
  chrome.tabs.create({ url });
});

// --- Send Current Tab to Jam ---
sendLinkBtn.addEventListener("click", async () => {
  const roomId = await getSavedRoomId();
  if (!roomId)
    return alert("No Jam Room joined yet. Please create or join one first!");

  const currentUrl = await getCurrentTabUrl();
  const jamUrl = `${JAM_BASE}/${roomId}?url=${encodeURIComponent(currentUrl)}`;
  chrome.tabs.create({ url: jamUrl });
});

// --- Show current room on popup open ---
(async () => {
  const roomId = await getSavedRoomId();
  if (roomId) {
    roomDisplay.innerHTML = `Room: <a href="${JAM_BASE}/${roomId}" target="_blank">${roomId}</a>`;
  } else {
    roomDisplay.textContent = "No room joined yet";
  }
})();
