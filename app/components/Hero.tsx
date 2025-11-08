"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import {
  NotificationProvider,
  TransactionPopupProvider,
  useNotification,
  useTransactionPopup,
} from "@blockscout/app-sdk";

const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // your test PYUSD address
const PLATFORM_ADDRESS = "0x81011A2d575f4f9AB78A5636F850cA1ac5a93b3C"; // replace with your receiver wallet
const PAYMENT_AMOUNT = "0.10";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function HeroContent() {
  const [roomId, setRoomId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://freejam4u.onrender.com";

  const { openTxToast } = useNotification();
  const { openPopup } = useTransactionPopup();

  const generateRoomId = (length = 32) => {
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

  // 👉 Function to switch/add Sepolia automatically
  const ensureSepoliaNetwork = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      console.log("✅ Switched to Sepolia network");
    } catch (switchError: any) {
      // If network not found, add it
      if (switchError.code === 4902) {
        console.log("🪄 Adding Sepolia network...");
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: "Sepolia Test Network",
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://eth-sepolia.blockscout.com"],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  };

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);

      /* if (!window.ethereum) {
        alert("Please install MetaMask");
        setIsCreating(false);
        return;
      }

      // Step 0: Ensure Sepolia network is selected
      await ensureSepoliaNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Step 1: Pay 10 cents in PYUSD
      const contract = new ethers.Contract(PYUSD_SEPOLIA, erc20Abi, signer);
      const decimals = await contract.decimals();
      const amount = ethers.parseUnits(PAYMENT_AMOUNT, decimals);

      const tx = await contract.transfer(PLATFORM_ADDRESS, amount);
      await openTxToast("11155111", tx.hash);
      await tx.wait();
*/
      // Step 2: Create Room after payment confirmation
      const newRoomId = generateRoomId();
      const title =
        prompt("Enter a title for your stream:", "My FreeJam4U Room") ||
        "Untitled Stream";

      const response = await fetch(`${API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: newRoomId,
          creatorAddress: PLATFORM_ADDRESS,
          title,
          paymentTxHash: "txHash",
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

  const viewHistory = () => {
    openPopup({
      chainId: "11155111",
      address: PLATFORM_ADDRESS,
    });
  };

  return (
    <section className="relative h-[100vh] flex flex-col justify-center items-center text-center overflow-hidden bg-black">
      {/* 🎥 Background */}
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

      {/* 🌈 Ambient Light Effects */}
      <div className="absolute top-[-8rem] left-[10%] w-[25rem] h-[25rem] bg-fuchsia-600/40 rounded-full blur-3xl opacity-40 animate-pulse" />
      <div className="absolute bottom-[-8rem] right-[10%] w-[25rem] h-[25rem] bg-indigo-600/40 rounded-full blur-3xl opacity-40 animate-pulse" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
        className="relative z-10 px-6 flex flex-col items-center"
      >
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.3)] leading-tight">
          FreeJam4U
        </h1>

        <p className="mt-6 text-gray-300 text-lg md:text-2xl max-w-2xl mx-auto leading-relaxed backdrop-blur-sm bg-black/10 px-4 py-2 rounded-xl shadow-inner">
          The world’s first decentralized Jamming & streaming platform — create
          rooms, stream, and support creators with on-chain payments.
        </p>

        {/* Embedded Room Creator */}
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
            {/*Pay <span className="text-green-400">$0.10 PYUSD</span> to start a
            decentralized jam room on Sepolia.*/}
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
              {isCreating ? "Processing..." : "Create Room"}
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
            Each stream is verifiable on-chain. All payments are transparent via{" "}
            <button
              onClick={viewHistory}
              className="text-blue-400 underline hover:text-blue-500"
            >
              Blockscout
            </button>
            .
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default function HeroSection() {
  return (
    <NotificationProvider>
      <TransactionPopupProvider>
        <HeroContent />
      </TransactionPopupProvider>
    </NotificationProvider>
  );
}
