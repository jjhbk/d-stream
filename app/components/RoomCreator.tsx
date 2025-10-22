"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import {
  NotificationProvider,
  TransactionPopupProvider,
  useNotification,
  useTransactionPopup,
} from "@blockscout/app-sdk";

const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // replace with your test token address
const PLATFORM_ADDRESS = "0x4eF27B6eb11b645139596a0b5E27e4B1662b0EC5"; // where payments go
const PAYMENT_AMOUNT = "0.10";
const SEPOLIA_CHAIN_ID = "11155111"; // Chain ID for Sepolia

const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function CreateRoomComponent() {
  const [isCreating, setIsCreating] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { openTxToast } = useNotification();
  const { openPopup } = useTransactionPopup();

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://freejam4u.onrender.com";

  const generateRoomId = (length = 12) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  };

  const handleCreateRoom = async () => {
    try {
      if (!window.ethereum) return alert("Please install MetaMask");
      setIsCreating(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      // Ensure user is on Sepolia
      if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) {
        alert("Please switch to Sepolia network in MetaMask!");
        return;
      }

      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const contract = new ethers.Contract(PYUSD_SEPOLIA, erc20Abi, signer);

      const decimals = await contract.decimals();
      const amount = ethers.parseUnits(PAYMENT_AMOUNT, decimals);

      // --- Step 1: Payment Transaction ---
      const tx = await contract.transfer(PLATFORM_ADDRESS, amount);
      setTxHash(tx.hash);

      // Show live toast via Blockscout SDK
      await openTxToast(SEPOLIA_CHAIN_ID, tx.hash);

      await tx.wait();
      console.log(`✅ Payment complete: ${tx.hash}`);

      // --- Step 2: Create Room ---
      const newRoomId = generateRoomId();
      const title =
        prompt("Enter room title:", "My DStream Jam Room") || "Untitled Room";

      const res = await fetch(`${API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: newRoomId,
          creatorAddress: userAddress,
          title,
          paymentTxHash: tx.hash,
        }),
      });

      if (!res.ok) throw new Error("Room creation failed");
      const data = await res.json();
      setRoomId(data.room.roomId);

      alert("🎉 Room created successfully!");
    } catch (err) {
      console.error("Room creation error:", err);
      alert("Failed to create room with payment.");
    } finally {
      setIsCreating(false);
    }
  };

  const viewHistory = () => {
    openPopup({
      chainId: SEPOLIA_CHAIN_ID,
      address: PLATFORM_ADDRESS,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-900 text-white p-6 rounded-xl shadow-lg w-full max-w-lg border border-fuchsia-700/30">
      <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
        🎧 DStream Room Creator (Sepolia)
      </h1>
      <p className="text-gray-400 text-center mb-4">
        Pay <span className="text-green-400">$0.10 PYUSD</span> on Sepolia to
        create your Jam Room.
      </p>

      <button
        disabled={isCreating}
        onClick={handleCreateRoom}
        className={`px-6 py-3 rounded-lg font-semibold transition ${
          isCreating
            ? "bg-gray-700 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {isCreating ? "Processing Payment..." : "Create Room for $0.10"}
      </button>

      {txHash && (
        <div className="mt-4 text-sm text-gray-300">
          Transaction:{" "}
          <a
            href={`https://eth-sepolia.blockscout.com/tx/${txHash}`}
            target="_blank"
            className="text-blue-400 underline"
          >
            {txHash.slice(0, 10)}...
          </a>
        </div>
      )}

      {roomId && (
        <p className="mt-4 text-green-400">
          ✅ Room Created: <span className="font-mono">{roomId}</span>
        </p>
      )}

      <button
        onClick={viewHistory}
        className="mt-6 px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm"
      >
        View Payment History
      </button>
    </div>
  );
}
