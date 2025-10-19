"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import screenfull from "screenfull";
import ReactPlayer from "react-player";
import Duration from "../../components/Duration";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useSearchParams } from "next/navigation";

interface WSMessage {
  type: "join" | "media-change" | "playback" | "seek" | "volume" | "sync-state"; // 👈 new message type for playback sync
  roomId: string;
  url?: string; // media URL
  playing?: boolean; // play/pause state
  time?: number; // seek position (fraction 0–1)
  volume?: number; // volume level
}

interface Track {
  _id: string;
  title: string;
  url: string;
  addedBy: string;
  playedAt?: string | null;
}

interface RoomData {
  room: {
    roomId: string;
    title: string;
    creatorAddress: string;
    description?: string;
  };
  tracks: Track[];
}

export default function JamPage() {
  const { roomId } = useParams();
  const WS_URL =
    process.env.NEXT_PUBLIC_WS_URL || "wss://freejam4u.onrender.com/ws";
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://freejam4u.onrender.com";

  // --- WebSocket and Player refs ---
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();

  const sharedUrl = searchParams.get("url");

  const initialState = {
    src: undefined,
    pip: false,
    playing: false,
    controls: false,
    light: false,
    volume: 1,
    muted: false,
    played: 0,
    loaded: 0,
    duration: 0,
    playbackRate: 1.0,
    loop: false,
    seeking: false,
    loadedSeconds: 0,
    playedSeconds: 0,
  };

  type PlayerState = Omit<typeof initialState, "src"> & { src?: string };

  // --- Local state ---
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [newTrack, setNewTrack] = useState("");
  const [state, setState] = useState<PlayerState>(initialState);
  const [userAddress, setUserAddress] = useState<string | null>(null);

  const {
    src,
    playing,
    controls,
    light,
    volume,
    muted,
    loop,
    played,
    loaded,
    duration,
    playbackRate,
    pip,
  } = state;

  const SEPARATOR = " · ";

  // ============================================================
  //  🎵 LOAD ROOM + TRACKS FROM BACKEND
  // ============================================================
  const fetchRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (!res.ok) throw new Error("Room not found");
      const data = await res.json();
      setRoomData(data);
      setPlaylist(data.tracks || []);
    } catch (err) {
      console.error("Error loading room:", err);
    }
  };

  useEffect(() => {
    fetchRoom();
  }, [roomId]);

  // ============================================================
  //  🔊 WEBSOCKET CONNECTION
  // ============================================================
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?roomId=${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as WSMessage;

        if (data.roomId !== roomId) return;

        switch (data.type) {
          case "media-change":
            if (data.url) loadMedia(data.url, false);
            break;

          case "playback":
            applyRemotePlayback(Boolean(data.playing));
            break;

          case "seek":
            if (typeof data.time === "number") applyRemoteSeek(data.time);
            break;

          case "volume":
            if (typeof data.volume === "number") applyRemoteVolume(data.volume);
            break;

          case "sync-state": // 👈 new unified sync event
            if (data.url) {
              // Load the current track from the server
              loadMedia(data.url, false, true);

              // Apply seek if provided
              if (typeof data.time === "number") {
                // small delay ensures ReactPlayer is ready
                setTimeout(() => applyRemoteSeek(data.time!), 800);
              }

              // Optionally auto-play to keep in sync
              setTimeout(() => applyRemotePlayback(true), 1000);
            }
            break;
        }
      } catch (err) {
        console.error("Invalid WebSocket message", err);
      }
    };

    ws.onclose = () => console.log("❌ WebSocket closed");

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId]);

  // inside JamPage useEffect
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      if (!playerRef.current || !state.playing || !roomData?.room) return;

      // 🧠 Only creator updates DB
      if (userAddress !== roomData.room.creatorAddress.toLowerCase()) return;

      const current = playerRef.current.currentTime;
      const duration = playerRef.current.duration || 1;
      const fraction = current / duration;

      try {
        await fetch(`${API_URL}/api/rooms/${roomId}/seek`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time: fraction, address: userAddress }),
        });
      } catch (err) {
        console.error("Seek sync failed:", err);
      }
    }, 8000);

    return () => clearInterval(syncInterval);
  }, [state.playing, userAddress, roomData]);

  // --- Player ref callback ---
  const setPlayerRefCallback = useCallback((player: HTMLVideoElement) => {
    if (!player) return;
    playerRef.current = player;
    console.log("Video element:", player);
  }, []);
  const broadcast = (msg: Omit<WSMessage, "roomId">) => {
    if (wsRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...msg, roomId }));
    }
  };

  // ============================================================
  //  🎬 MEDIA CONTROL HANDLERS
  // ============================================================
  const loadMedia = (url: string, broadcastMsg = true, autoPlay = false) => {
    setState((prev) => ({
      ...prev,
      src: url,
      played: 0,
      loaded: 0,
      pip: false,
      playing: false, // <-- set playing to true for remote clients
    }));

    if (playerRef.current && autoPlay) {
      playerRef.current.play().catch(() => {}); // start playback
    }

    if (broadcastMsg) broadcast({ type: "media-change", url });
  };

  const handlePlay = () => {
    const player = playerRef.current;
    if (!player) return;

    player
      .play()
      .then(() => {
        setState((prev) => ({ ...prev, playing: true }));
        broadcast({ type: "playback", playing: true }); // ONLY LOCAL
      })
      .catch((err) => console.error(err));
  };

  const handlePause = () => {
    const player = playerRef.current;
    if (!player) return;

    player.pause();
    setState((prev) => ({ ...prev, playing: false }));
    broadcast({ type: "playback", playing: false }); // ONLY LOCAL
  };

  const stopMedia = () => {
    setState((prev) => ({
      ...prev,
      src: undefined,
      playing: false,
      played: 0,
    }));
    broadcast({ type: "playback", playing: false });
  };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = parseFloat(event.target.value);
    setState((prev) => ({ ...prev, played: f }));
    if (playerRef.current && playerRef.current.duration) {
      playerRef.current.currentTime = f * playerRef.current.duration;
      broadcast({ type: "seek", time: f });
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(event.target.value);
    setState((prev) => ({ ...prev, volume: v }));
    if (playerRef.current) playerRef.current.volume = v;
    broadcast({ type: "volume", volume: v });
  };

  const handleLoadUrl = () => {
    const url = urlInputRef.current?.value.trim();
    if (!url) return;
    loadMedia(url);
  };

  const requestFullscreen = () => {
    if (playerRef.current && screenfull.isEnabled) {
      screenfull.request(playerRef.current).catch(() => {});
    }
  };

  // --- Apply remote actions ---
  const applyRemotePlayback = (play: boolean) => {
    setState((prev) => ({ ...prev, playing: play }));
    if (playerRef.current)
      play ? playerRef.current.play() : playerRef.current.pause();
  };

  const applyRemoteSeek = (timeFraction: number) => {
    if (playerRef.current && playerRef.current.duration) {
      playerRef.current.currentTime = timeFraction * playerRef.current.duration;
      setState((prev) => ({ ...prev, played: timeFraction }));
    }
  };

  const applyRemoteVolume = (v: number) => {
    setState((prev) => ({ ...prev, volume: v }));
    if (playerRef.current) playerRef.current.volume = v;
  };

  // --- Player progress events ---
  const handleProgress = () => {
    const player = playerRef.current;
    if (!player || state.seeking || !player.buffered?.length) return;
    setState((prev) => ({
      ...prev,
      loadedSeconds: player.buffered.end(player.buffered.length - 1),
      loaded: player.buffered.end(player.buffered.length - 1) / player.duration,
    }));
  };

  const handleTimeUpdate = () => {
    const player = playerRef.current;
    if (!player || state.seeking) return;
    if (!player.duration) return;
    setState((prev) => ({
      ...prev,
      playedSeconds: player.currentTime,
      played: player.currentTime / player.duration,
      duration: player.duration,
    }));
  };

  useEffect(() => {
    if (sharedUrl) {
      loadMedia(decodeURIComponent(sharedUrl), false, true);
    }
  }, [sharedUrl]);

  useEffect(() => {
    const connectWallet = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setUserAddress(address.toLowerCase());
      } catch (err) {
        console.error("MetaMask not connected:", err);
      }
    };
    connectWallet();
  }, []);
  // ============================================================
  //  🎧 PLAYLIST MANAGEMENT
  // ============================================================
  const addTrack = async () => {
    if (!newTrack.trim()) return alert("Enter a valid URL or track name");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const res = await fetch(`${API_URL}/api/rooms/${roomId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTrack,
          url: newTrack,
          addedBy: address,
        }),
      });

      if (res.ok) {
        setNewTrack("");
        fetchRoom();
      } else {
        alert("Error adding track");
      }
    } catch (err) {
      console.error("Add track error:", err);
    }
  };

  // ============================================================
  //  🎨 RENDER UI
  // ============================================================
  return (
    <main className="min-h-screen p-6 bg-gray-900 text-white flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold">
        🎵 {roomData?.room?.title || "Jam Room"} ({roomId})
      </h1>
      {roomData && (
        <p className="text-gray-400 text-sm">
          Created by:{" "}
          <span className="text-blue-400">{roomData.room.creatorAddress}</span>
        </p>
      )}

      {/* Player */}
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl p-6 shadow-lg flex flex-col gap-6">
        <div
          className="player-wrapper rounded-lg overflow-hidden bg-black"
          style={{ aspectRatio: "16/9", width: "100%" }}
        >
          {state.src ? (
            <ReactPlayer
              ref={setPlayerRefCallback}
              className="react-player"
              style={{ width: "100%", height: "auto", aspectRatio: "16/9" }}
              src={src}
              pip={pip}
              playing={playing}
              controls={controls}
              light={light}
              loop={loop}
              playbackRate={playbackRate}
              volume={volume}
              muted={muted}
              config={{
                youtube: {
                  color: "white",
                },
                vimeo: {
                  color: "ffffff",
                },
                spotify: {
                  preferVideo: true,
                },
                tiktok: {
                  fullscreen_button: true,
                  progress_bar: true,
                  play_button: true,
                  volume_control: true,
                  timestamp: false,
                  music_info: false,
                  description: false,
                  rel: false,
                  native_context_menu: true,
                  closed_caption: false,
                },
              }}
              onLoadStart={() => console.log("onLoadStart")}
              onReady={() => console.log("onReady")}
              onStart={(e) => console.log("onStart", e)}
              onPlay={handlePlay}
              //onEnterPictureInPicture={handleEnterPictureInPicture}
              //onLeavePictureInPicture={handleLeavePictureInPicture}
              onPause={handlePause}
              // onRateChange={handleRateChange}
              onSeeking={(e) => console.log("onSeeking", e)}
              onSeeked={(e) => console.log("onSeeked", e)}
              // onEnded={handleEnded}
              onError={(e) => console.log("onError", e)}
              onTimeUpdate={handleTimeUpdate}
              onProgress={handleProgress}
              // onDurationChange={handleDurationChange}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No media loaded
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 justify-center items-center mt-2">
          <button
            className="px-4 py-2 bg-indigo-600 rounded"
            onClick={playing ? handlePause : handlePlay}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            className="px-4 py-2 bg-green-600 rounded"
            onClick={requestFullscreen}
          >
            Fullscreen
          </button>
          <button
            className={`px-4 py-2 rounded ${
              muted ? "bg-gray-500" : "bg-yellow-500"
            }`}
            onClick={() => setState((p) => ({ ...p, muted: !p.muted }))}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        {/* Seek & Volume */}
        <div className="flex flex-col gap-2 mt-2 w-full">
          <label className="text-sm text-gray-300">Seek</label>
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={played}
            onChange={handleSeekChange}
          />
          <label className="text-sm text-gray-300 mt-2">Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>

        {/* Add Track */}
        <div className="flex gap-2 mt-4">
          <input
            ref={urlInputRef}
            type="text"
            placeholder="Enter track URL or title"
            value={newTrack}
            onChange={(e) => setNewTrack(e.target.value)}
            className="flex-1 px-3 py-2 rounded bg-gray-700 text-white"
            onKeyDown={(e) => e.key === "Enter" && addTrack()}
          />
          <button className="px-4 py-2 bg-blue-600 rounded" onClick={addTrack}>
            Add
          </button>
        </div>

        <p className="text-sm text-gray-400">
          {userAddress?.toLowerCase() ===
          roomData?.room?.creatorAddress?.toLowerCase()
            ? "🎧 You are the host (playback controller)"
            : "👥 You are a participant (synced listener)"}
        </p>

        {/* Playlist */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">🎧 Playlist</h2>
          {playlist.length === 0 ? (
            <p className="text-gray-400 text-sm">No tracks yet.</p>
          ) : (
            <ul className="space-y-2">
              {playlist.map((track) => (
                <li
                  key={track._id}
                  className={`p-2 rounded ${
                    track.playedAt ? "bg-gray-700" : "bg-gray-600"
                  } flex justify-between items-center`}
                >
                  <button
                    className="text-blue-400 underline text-left"
                    onClick={() => loadMedia(track.url || track.title)}
                  >
                    {track.title}
                  </button>
                  {track.playedAt && (
                    <span className="text-sm text-gray-400">✔ Played</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Duration */}
        <div className="text-center mt-2 text-sm text-gray-300">
          <Duration seconds={state.duration * state.played || 0} /> /{" "}
          <Duration seconds={state.duration || 0} />
        </div>
      </div>
    </main>
  );
}
