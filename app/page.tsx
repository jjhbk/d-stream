import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import FAQ from "./components/FAQ";
import WalletCTA from "./components/WalletCTA";
import RoomCreator from "./components/RoomCreator";
import {
  NotificationProvider,
  TransactionPopupProvider,
} from "@blockscout/app-sdk";

export default function Page() {
  return (
    <main className="flex flex-col w-full text-white bg-gray-900">
      <Hero />
      <Features />
      <HowItWorks />
      <FAQ />

      <footer className="mt-16 text-center text-gray-500 py-8 border-t border-gray-700">
        © 2025 DStream — Decentralized, censorship-free streaming.
      </footer>
    </main>
  );
}
