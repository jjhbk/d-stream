"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import { useNotification, useTransactionPopup } from "@blockscout/app-sdk";

const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // your test PYUSD contract
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111 in hex
const SEPOLIA_CHAIN_ID = "11155111";

const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

interface TipCreatorProps {
  creatorAddress: string | undefined;
}

export default function TipCreator({ creatorAddress }: TipCreatorProps) {
  const [tipAmount, setTipAmount] = useState("");
  const [isTipping, setIsTipping] = useState(false);

  const { openTxToast } = useNotification();
  const { openPopup } = useTransactionPopup();

  // 🪄 Ensure Sepolia network is active
  const ensureSepoliaNetwork = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      console.log("✅ Switched to Sepolia network");
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        console.log("🪄 Adding Sepolia network...");
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
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

  const handleTip = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask");
        return;
      }

      setIsTipping(true);

      // Step 1: Ensure user is on Sepolia
      await ensureSepoliaNetwork();

      // Step 2: Prepare transaction
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(PYUSD_SEPOLIA, erc20Abi, signer);
      const decimals = await contract.decimals();
      const amount = ethers.parseUnits(tipAmount, decimals);

      // Step 3: Send tip
      const tx = await contract.transfer(creatorAddress, amount);
      await openTxToast(SEPOLIA_CHAIN_ID, tx.hash);
      await tx.wait();

      alert(`✅ You tipped ${tipAmount} PYUSD successfully!`);
      setTipAmount("");
    } catch (err) {
      console.error("💥 Tipping error:", err);
      alert("Failed to send tip.");
    } finally {
      setIsTipping(false);
    }
  };

  const viewHistory = () => {
    openPopup({
      chainId: SEPOLIA_CHAIN_ID,
      address: creatorAddress,
    });
  };

  return (
    <div className="mt-8 bg-gray-900/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-800 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
      <h2 className="text-2xl font-bold text-yellow-400 mb-3">
        💰 Support the Creator
      </h2>
      <p className="text-gray-300 mb-3">
        Send a tip directly in{" "}
        <span className="text-green-400">PYUSD (Sepolia)</span> to this creator.
      </p>

      <div className="mt-4 flex gap-2 items-center justify-center">
        <input
          type="text"
          placeholder="Tip amount (PYUSD)"
          value={tipAmount}
          onChange={(e) => setTipAmount(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 w-40"
        />
        <button
          onClick={handleTip}
          disabled={isTipping}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            isTipping
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-yellow-600 hover:bg-yellow-700"
          }`}
        >
          {isTipping ? "Tipping..." : "💸 Tip Creator"}
        </button>
      </div>

      <button
        onClick={viewHistory}
        className="mt-4 px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 rounded-lg"
      >
        View Creator’s Transactions
      </button>
    </div>
  );
}
