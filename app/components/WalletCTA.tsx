"use client";
import { useState } from "react";
import { ethers } from "ethers";

export default function WalletCTA() {
  const [account, setAccount] = useState<string | null>(null);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      setAccount(await signer.getAddress());
    } else {
      alert("Install MetaMask to continue.");
    }
  };

  return (
    <div>
      {account ? (
        <button className="px-6 py-3 bg-green-500 rounded-lg text-white font-bold">
          Connected: {account.slice(0, 6)}...{account.slice(-4)}
        </button>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-yellow-500 rounded-lg text-white font-bold hover:bg-yellow-600"
        >
          Connect Wallet & Watch
        </button>
      )}
    </div>
  );
}
