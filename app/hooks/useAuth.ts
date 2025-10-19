import { useState } from "react";
import { ethers } from "ethers";
import { SiweMessage } from "siwe";

export default function useAuth() {
  const [address, setAddress] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const signIn = async () => {
    if (!window.ethereum) return alert("Please install MetaMask");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();

    // Get nonce from backend
    const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
      credentials: "include",
    });
    const { nonce } = await nonceRes.json();

    // Create SIWE message properly
    const message = new SiweMessage({
      domain: window.location.host,
      address: addr,
      statement: "Sign in to FreeJam4U",
      uri: window.location.origin,
      version: "1",
      chainId: 1,
      nonce,
    }).prepareMessage();

    // Ask user to sign this message
    const signature = await signer.signMessage(message);

    // Send both message + signature to backend
    const verifyRes = await fetch(`${API_URL}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, signature }),
    });

    const data = await verifyRes.json();
    if (data.ok) {
      setAddress(data.address);
    } else {
      alert("Authentication failed");
      console.error(data);
    }
  };

  return { address, signIn };
}
