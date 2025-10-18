let lastUrl = location.href;

function notifyBackground(newUrl) {
  chrome.runtime.sendMessage({ type: "video-changed", newUrl });
}

// Observe URL changes (SPA support)
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log("[JamRoom] Detected video URL change:", lastUrl);
    notifyBackground(lastUrl);
  }
});

observer.observe(document, { subtree: true, childList: true });

// Also catch YouTube's internal navigation events
window.addEventListener("yt-navigate-finish", () => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log("[JamRoom] Detected YouTube navigation:", lastUrl);
    notifyBackground(lastUrl);
  }
});

// Initial trigger when the page first loads
notifyBackground(location.href);
