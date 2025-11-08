"use client";
import { motion } from "framer-motion";

export default function Features() {
  const features = [
    {
      title: "Decentralized Storage",
      desc: "Censorship-resistant video hosting powered by IPFS & Filecoin.",
    },
    {
      title: "Instant Crypto Payouts",
      desc: "Creators receive earnings instantly via Superfluid streaming payments.",
    },
    {
      title: "Cross-Chain Payments",
      desc: "Pay using ETH, Polygon, or PayPal USD seamlessly.",
    },
    {
      title: "Token-Gated Access",
      desc: "Exclusive content unlocked via NFTs or token ownership.",
    },
    {
      title: "Global Freedom",
      desc: "No borders, no bans — watch anywhere, anytime.",
    },
  ];

  return (
    <section className="relative py-28 bg-gradient-to-b from-[#0f0f1a] to-black text-white overflow-hidden">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="text-center text-5xl font-extrabold mb-20"
      >
        Why <span className="text-fuchsia-400">FreeJam4U</span>?
      </motion.h2>
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-10 px-6">
        {features.map((f, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="relative p-6 border border-white/10 rounded-2xl backdrop-blur-md bg-white/5 shadow-lg"
          >
            <h3 className="text-2xl font-bold mb-3 text-fuchsia-400">
              {f.title}
            </h3>
            <p className="text-gray-300 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
