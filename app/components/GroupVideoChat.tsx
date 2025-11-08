"use client";

import React, { useEffect, useRef, useState } from "react";

interface GroupVideoChatProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
  userId: string; // comes from JamPage
}

interface StreamMap {
  [peerId: string]: MediaStream;
}

interface PeerMap {
  [peerId: string]: RTCPeerConnection;
}

export default function GroupVideoChat({
  wsRef,
  roomId,
  userId,
}: GroupVideoChatProps) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [streams, setStreams] = useState<StreamMap>({});
  const [peers, setPeers] = useState<PeerMap>({});

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const audioAnalyser = useRef<AnalyserNode | null>(null);
  const audioDataArray = useRef<Uint8Array | null>(null);

  const sendMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...msg, roomId }));
    }
  };

  // 🧩 Create Peer Connection
  const createPeerConnection = (peerId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
    });

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      setStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice-candidate",
          to: peerId,
          from: userId,
          candidate: event.candidate,
        });
      }
    };

    if (initiator) {
      pc.createOffer()
        .then((offer) => {
          pc.setLocalDescription(offer);
          sendMessage({ type: "offer", to: peerId, from: userId, sdp: offer });
        })
        .catch(console.error);
    }

    setPeers((prev) => ({ ...prev, [peerId]: pc }));
    return pc;
  };

  // 🧠 Handle signaling messages
  useEffect(() => {
    if (!wsRef.current) return;
    const ws = wsRef.current;

    ws.onmessage = async (ev) => {
      const data = JSON.parse(ev.data);
      if (data.roomId !== roomId) return;

      switch (data.type) {
        // When someone joins, existing peers respond with "new-peer"
        case "join-video":
          if (data.userId !== userId) {
            sendMessage({ type: "new-peer", to: data.userId, from: userId });
          }
          break;

        // The joining peer receives "new-peer" and starts offers
        case "new-peer":
          if (data.to === userId) {
            createPeerConnection(data.from, true);
          }
          break;

        case "offer": {
          if (data.to !== userId) return;
          const pc = createPeerConnection(data.from, false);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendMessage({
            type: "answer",
            to: data.from,
            from: userId,
            sdp: answer,
          });
          break;
        }

        case "answer": {
          if (data.to !== userId) return;
          const pc = peers[data.from];
          if (pc)
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          break;
        }

        case "ice-candidate": {
          if (data.to !== userId) return;
          const pc = peers[data.from];
          if (pc && data.candidate)
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          break;
        }
      }
    };
  }, [wsRef.current, peers, roomId, userId]);

  // 🎤 Join room with camera & mic
  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Speaker detection setup
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioAnalyser.current = analyser;
      audioDataArray.current = new Uint8Array(analyser.frequencyBinCount);

      const detectSpeech = () => {
        if (!audioAnalyser.current || !audioDataArray.current) return;
        audioAnalyser.current.getByteFrequencyData(audioDataArray.current);
        const avg =
          audioDataArray.current.reduce((a, b) => a + b, 0) /
          audioDataArray.current.length;
        if (avg > 50) setActiveSpeaker(userId);
        else if (activeSpeaker === userId) setActiveSpeaker(null);
        requestAnimationFrame(detectSpeech);
      };
      detectSpeech();

      // Announce join
      sendMessage({ type: "join-video", userId });
      setJoined(true);
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
    }
  };

  // 🎚️ Mute / Unmute
  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  // 📷 Camera toggle
  const toggleCam = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  // 🖥 Screen share
  const startScreenShare = async () => {
    if (!localStream.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.values(peers).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      screenTrack.onended = () => {
        const camTrack = localStream.current?.getVideoTracks()[0];
        Object.values(peers).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(camTrack!);
        });
        if (localVideoRef.current)
          localVideoRef.current.srcObject = localStream.current!;
        setScreenSharing(false);
      };
      setScreenSharing(true);
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  return (
    <div className="w-full max-w-5xl bg-gray-900/70 rounded-2xl p-6 mt-10 border border-gray-800 shadow-lg">
      <h2 className="text-2xl font-bold text-fuchsia-400 mb-4">
        🎥 Group Video Chat
      </h2>

      {!joined ? (
        <button
          onClick={joinRoom}
          className="px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg text-white font-semibold"
        >
          Join with Camera & Mic
        </button>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <button
              onClick={toggleMic}
              className={`px-4 py-2 rounded-lg font-semibold ${
                micOn ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {micOn ? "🎤 Mic On" : "🔇 Mic Off"}
            </button>

            <button
              onClick={toggleCam}
              className={`px-4 py-2 rounded-lg font-semibold ${
                camOn ? "bg-indigo-600" : "bg-gray-600"
              }`}
            >
              {camOn ? "📷 Camera On" : "🚫 Camera Off"}
            </button>

            <button
              onClick={startScreenShare}
              className={`px-4 py-2 rounded-lg font-semibold ${
                screenSharing ? "bg-yellow-600" : "bg-purple-600"
              }`}
            >
              {screenSharing ? "🖥 Stop Sharing" : "🖥 Share Screen"}
            </button>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Local video */}
            <div
              className={`relative border rounded-lg overflow-hidden ${
                activeSpeaker === userId
                  ? "border-fuchsia-500 shadow-[0_0_15px_rgba(232,121,249,0.8)]"
                  : "border-gray-700"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <p className="absolute bottom-2 left-2 text-xs text-fuchsia-400">
                You
              </p>
            </div>

            {/* Remote participants */}
            {Object.entries(streams).map(([peerId, stream]) => (
              <div
                key={peerId}
                className={`relative border rounded-lg overflow-hidden ${
                  activeSpeaker === peerId
                    ? "border-fuchsia-500 shadow-[0_0_15px_rgba(232,121,249,0.8)]"
                    : "border-gray-700"
                }`}
              >
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && !el.srcObject) el.srcObject = stream;
                  }}
                  className="w-full h-full object-cover"
                />
                <p className="absolute bottom-2 left-2 text-xs text-gray-400">
                  {peerId.slice(0, 6)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
