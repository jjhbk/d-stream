"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import screenfull from "screenfull";
import ReactPlayer from "react-player";
import Duration from "../../components/Duration";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import TipCreator from "@/app/components/TipCreator";
import TippingDashboard from "@/app/components/TippingDashboard";
import {
  NotificationProvider,
  TransactionPopupProvider,
} from "@blockscout/app-sdk";
import { v4 as uuidv4 } from "uuid";
import GroupChat from "@/app/components/GroupChat";
import GroupVideoChat from "@/app/components/GroupVideoChat";

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
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistDesc, setPlaylistDesc] = useState("");
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [newTrack, setNewTrack] = useState("");
  const [state, setState] = useState<PlayerState>(initialState);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState("");
  const [tipHistory, setTipHistory] = useState([]);
  const [totalTips, setTotalTips] = useState("");
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
  const [userId, setUserId] = useState<string>("");

  // 🧩 Generate or load persistent user ID
  useEffect(() => {
    // ✅ Only runs on the client side
    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("userId");
      if (!storedId) {
        storedId = uuidv4();
        localStorage.setItem("userId", storedId);
      }
      setUserId(storedId);
    }
  }, []);
  //======================================================
  //  🎵 LOAD ROOM + TRACKS FROM BACKEND
  // ============================================================
  const fetchRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (!res.ok) throw new Error("Room not found");

      const data = await res.json();

      setRoomData(data);
      setPlaylists(data.playlists || []); // ✅ all playlists

      // If a playlist is selected, refresh its track list too
      if (activePlaylist?._id) {
        const refreshed = data.playlists.find(
          (p) => p._id === activePlaylist._id
        );
        setActivePlaylist(refreshed || null);
      }
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

    const handleOpen = () => {
      console.log("✅ WebSocket connected");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    const handleMessage = (ev: MessageEvent) => {
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

          case "sync-state":
            if (data.url) {
              loadMedia(data.url, false, true);

              if (typeof data.time === "number") {
                // small delay ensures player is ready
                setTimeout(() => applyRemoteSeek(data.time!), 800);
              }

              setTimeout(() => applyRemotePlayback(true), 1000);
            }
            break;
        }
      } catch (err) {
        console.error("Invalid WebSocket message", err);
      }
    };

    const handleClose = () => console.log("❌ WebSocket closed");

    // ✅ Use addEventListener so other components can also listen safely
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("close", handleClose);

    return () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("close", handleClose);
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

  /*useEffect(() => {
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
*/
  const fetchPlaylists = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/playlists`);
      const data = await res.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      console.error("Error loading playlists:", err);
    }
  };
  useEffect(() => {
    fetchPlaylists();
  }, [roomId]);

  const createPlaylist = async () => {
    if (!playlistTitle.trim()) return alert("Please enter a playlist name.");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const res = await fetch(`${API_URL}/api/rooms/${roomId}/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playlistTitle.trim(),
          description: playlistDesc.trim(),
          address,
        }),
      });

      if (res.ok) {
        setPlaylistTitle("");
        setPlaylistDesc("");
        fetchPlaylists(); // refresh playlists list
        alert("✅ Playlist created successfully!");
      } else {
        alert("Error creating playlist.");
      }
    } catch (err) {
      console.error("Playlist creation error:", err);
    }
  };

  // ============================================================
  //  🎧 PLAYLIST MANAGEMENT
  // ============================================================
  const addTrack = async () => {
    if (!newTrack.trim()) return alert("Enter a valid URL or track name");

    if (!activePlaylist?._id) {
      return alert("Please select or create a playlist first!");
    }

    try {
      // 🔹 Get user wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // 🔹 Add track to selected playlist
      const res = await fetch(
        `${API_URL}/api/rooms/${roomId}/playlists/${activePlaylist._id}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTrack.trim(),
            url: newTrack.trim(),
            addedBy: address,
          }),
        }
      );

      if (res.ok) {
        setNewTrack("");
        fetchRoom(); // refresh playlist list + tracks
        alert(`✅ Added to playlist: ${activePlaylist.title}`);
      } else {
        const errData = await res.json();
        alert("❌ Error adding track: " + (errData.error || "Unknown"));
      }
    } catch (err) {
      console.error("Add track error:", err);
      alert("Error connecting to wallet or server.");
    }
  };
  const handleTip = async () => {
    if (!window.ethereum) return alert("Please install MetaMask");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const from = await signer.getAddress();

    const PYUSD = "0x81011A2d575f4f9AB78A5636F850cA1ac5a93b3C";
    const creator = roomData?.room?.creatorAddress;

    if (!creator) return alert("Creator address missing");

    const erc20Abi = [
      "function decimals() view returns (uint8)",
      "function transfer(address to, uint256 amount) returns (bool)",
    ];

    const contract = new ethers.Contract(PYUSD, erc20Abi, signer);

    const decimals = await contract.decimals();
    const amount = ethers.parseUnits(tipAmount, decimals);

    const tx = await contract.transfer(creator, amount);
    await tx.wait();

    alert(`🎉 Tip sent! Tx: ${tx.hash}`);
  };

  const fetchTips = async () => {
    const creator = roomData?.room?.creatorAddress;
    const PYUSD = "0x6c3ea9036406852006290770BEdFcAbA0e23a0e8";

    const res = await fetch(
      `https://eth.blockscout.com/api/v2/addresses/${creator}/token-transfers?token=${PYUSD}`
    );
    const data = await res.json();

    const incoming = data.items.filter(
      (t: any) => t.to.toLowerCase() === creator?.toLowerCase()
    );

    const total = incoming.reduce(
      (sum: any, tx: any) => sum + parseFloat(tx.value),
      0
    );
    setTipHistory(incoming);
    setTotalTips(total.toFixed(2));
  };

  // ============================================================
  //  🎨 RENDER UI
  // ============================================================
  return (
    <main className="relative min-h-screen p-8 bg-gradient-to-b from-[#0a0014] via-[#12002c] to-[#080011] text-white flex flex-col items-center">
      {/* Floating gradient glow background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10rem] left-[10%] w-[25rem] h-[25rem] bg-fuchsia-700/40 rounded-full blur-3xl opacity-50 animate-pulse" />
        <div className="absolute bottom-[-8rem] right-[15%] w-[25rem] h-[25rem] bg-indigo-700/40 rounded-full blur-3xl opacity-40 animate-pulse" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-8"
      >
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.3)]">
          🎵 {roomData?.room?.title || "FreeJam4U Jam Room"}
        </h1>
        <p className="mt-3 text-gray-400 text-sm">
          Room ID: <span className="text-indigo-400 font-mono">{roomId}</span> ·
          Created by{" "}
          <span className="text-fuchsia-400">
            {roomData?.room?.creatorAddress?.slice(0, 8)}...
          </span>
        </p>
      </motion.div>
      {/* Host/Participant Note */}
      <p className="text-sm text-gray-400 text-center mt-3">
        {userAddress?.toLowerCase() ===
        roomData?.room?.creatorAddress?.toLowerCase()
          ? "🎧 You are the host (controller)"
          : "👥 You are a listener (auto-synced)"}
      </p>
      {/* Playlist Management Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-3xl bg-gray-900/70 backdrop-blur-xl rounded-2xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)] mb-8 border border-gray-800"
      >
        <h2 className="text-2xl font-bold text-fuchsia-400 mb-4">
          🎶 Manage Playlists
        </h2>

        {/* Create Playlist */}
        <div className="bg-gray-800/70 p-5 rounded-xl mb-5">
          <h3 className="text-xl font-semibold text-white mb-3">
            ➕ Create Playlist
          </h3>
          <input
            type="text"
            placeholder="Playlist title"
            value={playlistTitle}
            onChange={(e) => setPlaylistTitle(e.target.value)}
            className="p-3 rounded bg-gray-700 text-white w-full mb-3 focus:ring-2 focus:ring-fuchsia-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={playlistDesc}
            onChange={(e) => setPlaylistDesc(e.target.value)}
            className="p-3 rounded bg-gray-700 text-white w-full mb-3 focus:ring-2 focus:ring-fuchsia-500"
          />
          <button
            onClick={createPlaylist}
            className="bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-5 py-2.5 rounded-lg text-white font-semibold transition"
          >
            Create Playlist
          </button>
        </div>

        {/* Playlist Selector */}
        <div>
          <label className="block mb-2 text-gray-300 font-semibold">
            🎧 Select Playlist
          </label>
          <select
            className="bg-gray-800 p-3 rounded-lg w-full border border-gray-700 focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => {
              const selected = playlists.find((p) => p._id === e.target.value);
              setActivePlaylist(selected || null);
            }}
          >
            <option value="">Select a playlist...</option>
            {playlists.map((p) => (
              <option key={p._id} value={p._id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Player */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-5xl bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_0_50px_rgba(88,28,135,0.3)] flex flex-col gap-6 border border-gray-800"
      >
        {/* Player */}
        <div className="rounded-lg overflow-hidden bg-black relative shadow-lg border border-gray-700">
          {src ? (
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
            <div className="w-full h-[400px] flex items-center justify-center text-gray-500">
              🎬 Load or select a track to start streaming
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 justify-center items-center mt-4">
          <button
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold"
            onClick={playing ? handlePause : handlePlay}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
            onClick={requestFullscreen}
          >
            ⛶ Fullscreen
          </button>
          <button
            className={`px-5 py-2 rounded-lg font-semibold ${
              muted ? "bg-gray-500" : "bg-yellow-500 hover:bg-yellow-600"
            }`}
            onClick={() => setState((p) => ({ ...p, muted: !p.muted }))}
          >
            {muted ? "🔈 Unmute" : "🔇 Mute"}
          </button>
        </div>

        {/* Next / Prev */}
        <div className="flex gap-4 justify-center mt-2">
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            disabled={!activePlaylist || currentTrackIndex === 0}
            onClick={() => {
              const prevIndex = Math.max(currentTrackIndex - 1, 0);
              setCurrentTrackIndex(prevIndex);
              const track = activePlaylist.tracks[prevIndex];
              loadMedia(track.url, true, true);
            }}
          >
            ⏮ Previous
          </button>
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            disabled={
              !activePlaylist ||
              currentTrackIndex >= (activePlaylist?.tracks?.length || 1) - 1
            }
            onClick={() => {
              const nextIndex = currentTrackIndex + 1;
              setCurrentTrackIndex(nextIndex);
              const track = activePlaylist.tracks[nextIndex];
              loadMedia(track.url, true, true);
            }}
          >
            ⏭ Next
          </button>
        </div>

        {/* Seek & Volume */}
        <div className="flex flex-col gap-3 mt-4">
          <label className="text-sm text-gray-300">⏱ Seek</label>
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={played}
            onChange={handleSeekChange}
            className="accent-fuchsia-500"
          />
          <label className="text-sm text-gray-300 mt-2">🔊 Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={volume}
            onChange={handleVolumeChange}
            className="accent-indigo-500"
          />
        </div>

        {/* Add Track */}
        <div className="flex gap-3 mt-4">
          <input
            ref={urlInputRef}
            type="text"
            placeholder="🎵 Enter track URL or title"
            value={newTrack}
            onChange={(e) => setNewTrack(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:ring-2 focus:ring-purple-500"
            onKeyDown={(e) => e.key === "Enter" && addTrack()}
          />
          <button
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            onClick={addTrack}
          >
            ➕ Add
          </button>
        </div>

        {/* Host/Participant Note */}
        <p className="text-sm text-gray-400 text-center mt-3">
          {userAddress?.toLowerCase() ===
          roomData?.room?.creatorAddress?.toLowerCase()
            ? "🎧 You are the host (controller)"
            : "👥 You are a listener (auto-synced)"}
        </p>

        {/* Playlist */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-fuchsia-400 mb-3">
            🎶 Current Playlist
          </h2>
          {activePlaylist?.tracks?.length ? (
            <ul className="space-y-2">
              {activePlaylist.tracks.map((track: any, i: number) => (
                <li
                  key={track._id}
                  className={`p-3 rounded-lg flex justify-between items-center ${
                    i === currentTrackIndex
                      ? "bg-fuchsia-700/30 border border-fuchsia-600"
                      : "bg-gray-700/50"
                  } transition`}
                >
                  <button
                    className="text-indigo-400 hover:underline text-left"
                    onClick={() => loadMedia(track.url || track.title)}
                  >
                    {i + 1}. {track.title}
                  </button>
                  {track.playedAt && (
                    <span className="text-sm text-gray-400">✔ Played</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No tracks yet.</p>
          )}
        </div>
        <GroupVideoChat
          wsRef={wsRef}
          roomId={roomId as string}
          userId={userId}
        />

        <GroupChat wsRef={wsRef} roomId={roomId as string} userId={userId} />

        {/* Duration */}
        <div className="text-center mt-4 text-sm text-gray-300">
          <Duration seconds={state.duration * state.played || 0} /> /{" "}
          <Duration seconds={state.duration || 0} />
        </div>
      </motion.div>
      <NotificationProvider>
        <TransactionPopupProvider>
          <TipCreator creatorAddress={roomData?.room?.creatorAddress} />
          <TippingDashboard
            creatorAddress={roomData?.room?.creatorAddress}
            tokenAddress="0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
            network="sepolia" // PYUSD mock
          />
        </TransactionPopupProvider>
      </NotificationProvider>
    </main>
  );
}
