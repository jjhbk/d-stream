"use client";
import { motion } from "framer-motion";
import WalletCTA from "./WalletCTA";
import RoomCreator from "./RoomCreator";

export default function Hero() {
  return (
    <section className="relative h-[90vh] flex flex-col justify-center items-center text-center overflow-hidden bg-black">
      {/* Animated Gradient / Video */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f1a] via-[#1a0033] to-black">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover opacity-30"
        >
          <source src="/cinematic-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black"></div>
      </div>

      {/* Hero Content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 px-6"
      >
        <h1 className="text-6xl md:text-8xl font-extrabold bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg">
          Watch. Pay. Own.
        </h1>
        <p className="text-lg md:text-2xl mt-6 text-gray-300 max-w-2xl mx-auto leading-relaxed">
          The world’s first decentralized streaming platform — pay-per-minute in
          crypto and support creators directly.
        </p>
        <div className="mt-10">
          <RoomCreator />
        </div>
      </motion.div>

      {/* Glow Orbs */}
      <div className="absolute -top-20 left-1/2 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl opacity-50 animate-pulse" />
      <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl opacity-30 animate-pulse" />
    </section>
  );
}
