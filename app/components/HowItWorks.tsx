"use client";
import { motion } from "framer-motion";

export default function HowItWorks() {
  const steps = [
    { step: "1", text: "Creators upload videos to decentralized storage." },
    { step: "2", text: "Viewers connect wallets and stream content." },
    { step: "3", text: "Smart contracts handle instant crypto payouts." },
  ];

  return (
    <section className="py-28 bg-black text-center text-white">
      <h2 className="text-5xl font-extrabold mb-16">How It Works</h2>
      <div className="flex flex-col md:flex-row justify-center items-center gap-12">
        {steps.map((s, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.1 }}
            className="relative w-64 h-64 bg-gradient-to-br from-fuchsia-600 to-purple-800 rounded-3xl flex flex-col justify-center items-center shadow-2xl"
          >
            <span className="text-6xl font-extrabold text-white/80 mb-4">
              {s.step}
            </span>
            <p className="text-lg text-gray-100 px-4">{s.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
