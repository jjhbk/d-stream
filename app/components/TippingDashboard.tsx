"use client";

import React, { useEffect, useState } from "react";

interface TippingDashboardProps {
  creatorAddress: string;
  tokenAddress: string; // PYUSD token address on Sepolia
}

export default function TippingDashboard({
  creatorAddress,
  tokenAddress,
}: TippingDashboardProps) {
  const [tips, setTips] = useState<any[]>([]);
  const [totalTips, setTotalTips] = useState("0.00");
  const [loading, setLoading] = useState(true);

  const fetchTips = async () => {
    if (!creatorAddress || !tokenAddress) return;

    try {
      setLoading(true);

      const res = await fetch(
        `https://eth-sepolia.blockscout.com/api/v2/addresses/${creatorAddress}/token-transfers`
      );
      const data = await res.json();

      if (!data?.items?.length) {
        console.log("No transfers found.");
        setTips([]);
        setTotalTips("0.00");
        return;
      }

      const pyusdTransfers = data.items.filter(
        (tx: any) =>
          tx.to?.hash?.toLowerCase() === creatorAddress.toLowerCase() &&
          tx.token?.address_hash?.toLowerCase() === tokenAddress.toLowerCase()
      );

      console.log(
        "🪙 PYUSD transfers found:",
        pyusdTransfers.length,
        pyusdTransfers
      );

      const simplified = pyusdTransfers.map((tx: any) => {
        // Convert decimals from string → number
        const decimals = Number(tx.token?.decimals || 6);

        // Parse raw integer value safely
        const rawValue = BigInt(tx.total.value || "0");

        // Convert to readable decimal
        const normalizedValue = Number(rawValue) / 10 ** decimals;
        console.log("values", rawValue, decimals, normalizedValue);
        // Use the correct transaction hash field
        const txHash = tx.transaction_hash || tx.tx_hash || "unknown";

        return {
          from: tx.from?.hash || "unknown",
          value: normalizedValue,
          symbol: tx.token?.symbol || "PYUSD",
          tx_hash: txHash,
        };
      });

      // Calculate total tips
      const total = simplified
        .reduce((sum: number, tx: any) => sum + tx.value, 0)
        .toFixed(2);

      console.log("💸 Simplified tips:", simplified);
      setTips(simplified);
      setTotalTips(total);
    } catch (err) {
      console.error("Error fetching tips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTips();
    const interval = setInterval(fetchTips, 20000);
    return () => clearInterval(interval);
  }, [creatorAddress, tokenAddress]);

  return (
    <div className="bg-gray-900/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-800 mt-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
      <h2 className="text-2xl font-bold text-fuchsia-400 mb-3">
        💸 Tipping Dashboard
      </h2>

      {loading ? (
        <p className="text-gray-400 text-sm">Fetching PYUSD tips...</p>
      ) : tips.length === 0 ? (
        <p className="text-gray-400 text-sm">No PYUSD tips yet.</p>
      ) : (
        <>
          <p className="text-gray-300 mb-3">
            Total Tips Received:{" "}
            <span className="text-green-400 font-semibold">
              {totalTips} PYUSD
            </span>
          </p>

          <div className="overflow-y-auto max-h-60 border-t border-gray-800 pt-2">
            {tips.map((tx: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-gray-800 py-2 text-sm"
              >
                <span className="text-gray-300 truncate w-1/3">
                  {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                </span>
                <span className="text-green-400">
                  {tx.value.toFixed(2)} {tx.symbol}
                </span>
                <a
                  href={`https://eth-sepolia.blockscout.com/tx/${tx.tx_hash}`}
                  target="_blank"
                  className="text-blue-400 hover:underline"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
