import express from "express";
import session from "express-session";
import { SiweMessage } from "siwe";
import User from "../models/User.js";

const router = express.Router();

router.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Step 1: Generate nonce
router.get("/nonce", (req, res) => {
  const nonce = Math.random().toString(36).substring(2);
  req.session.nonce = nonce;
  res.json({ nonce });
});

// Step 2: Verify signed SIWE message

router.post("/verify", async (req, res) => {
  try {
    const { message, signature } = req.body;
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (fields.success && fields.data.nonce === req.session.nonce) {
      const address = siweMessage.address.toLowerCase();

      let user = await User.findOne({ address });
      if (!user) user = await User.create({ address });

      req.session.user = { address };
      res.json({ ok: true, address });
    } else {
      res.status(400).json({ ok: false, error: "Invalid signature or nonce" });
    }
  } catch (err) {
    console.error("❌ SIWE verification failed:", err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});
// Step 3: Fetch current user
router.get("/me", (req, res) => {
  if (req.session.user) res.json(req.session.user);
  else res.status(401).json({ error: "Not logged in" });
});

export default router;
