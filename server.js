// ----- DEPENDENCIES -----
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

// ----- APP SETUP -----
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://halocrypto:Halley.117@cluster0.lhafth6.mongodb.net/?appName=Cluster0";

// ----- MONGODB -----
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// =========================
// 🧩 DEMO ACCOUNT SCHEMA
// =========================
const DemoAccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  balance: { type: Number, default: 1000 },
  createdAt: { type: Date, default: () => new Date() },
});
const DemoAccount = mongoose.model("DemoAccount", DemoAccountSchema);

// =========================
// 🤖 BOT SCHEMA
// =========================
const BotSchema = new mongoose.Schema({
  account: { type: String, index: true },
  coin: String, // BTCUSDT
  leverage: Number, // 1..3
  status: { type: String }, // RUNNING / STOPPED
  entryPrice: { type: Number, default: 0 },
  pnl: { type: Number, default: 0 },
  updatedAt: { type: Date, default: () => new Date() },
});
const Bot = mongoose.model("Bot", BotSchema);

// =========================
// 🌍 BASE ROUTES
// =========================
app.get("/", (_req, res) => {
  res.send("🚀 Halo Crypto Server up & MongoDB OK");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// =========================
// 💰 DEMO ACCOUNT ROUTES
// =========================

// Tüm demo hesapları getir
app.get("/api/demoAccounts", async (_req, res) => {
  try {
    const accounts = await DemoAccount.find().sort({ createdAt: -1 });
    res.json(accounts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Yeni demo hesap oluştur
app.post("/api/demoAccounts", async (req, res) => {
  try {
    const { name, balance } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const count = await DemoAccount.countDocuments();
    if (count >= 3)
      return res.status(400).json({ error: "Maximum 3 accounts allowed" });

    const newAccount = new DemoAccount({
      name,
      balance: balance || 1000,
    });

    await newAccount.save();
    res.status(201).json(newAccount);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Demo hesap sil
app.delete("/api/demoAccounts/:id", async (req, res) => {
  try {
    await DemoAccount.findByIdAndDelete(req.params.id);
    res.json({ message: "Account deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// 📈 BINANCE & BOT ROUTES
// =========================

// Binance fiyat
app.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    res.json({
      symbol: data.symbol,
      price: parseFloat(data.price),
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// SMA verileri
app.get("/sma", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    const fast = parseInt(req.query.fast || "9");
    const slow = parseInt(req.query.slow || "30");
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const limit = Math.max(fast, slow, 30);
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    const closes = data.map((k) => parseFloat(k[4]));
    const smaFast = closes.slice(-fast).reduce((a, b) => a + b, 0) / fast;
    const smaSlow = closes.slice(-slow).reduce((a, b) => a + b, 0) / slow;

    res.json({
      symbol,
      smaFast: Number(smaFast.toFixed(2)),
      smaSlow: Number(smaSlow.toFixed(2)),
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Bot başlat
app.post("/bot/start", async (req, res) => {
  try {
    const { account, coin, leverage = 1 } = req.body || {};
    if (!account || !coin)
      return res.status(400).json({ error: "account & coin required" });

    const bot = await Bot.findOneAndUpdate(
      { account },
      {
        account,
        coin: coin.toUpperCase(),
        leverage: Number(leverage) || 1,
        status: "RUNNING",
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    res.json({ message: "Bot started", bot });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Bot durdur
app.post("/bot/stop", async (req, res) => {
  try {
    const { account } = req.body || {};
    if (!account) return res.status(400).json({ error: "account required" });

    await Bot.updateOne(
      { account },
      { status: "STOPPED", updatedAt: new Date() }
    );

    res.json({ message: "Bot stopped" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Bot durumu
app.get("/bot/status", async (req, res) => {
  try {
    const account = String(req.query.account || "");
    if (!account) return res.status(400).json({ error: "account required" });

    const bot = await Bot.findOne({ account });
    res.json(bot || { message: "No bot" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Tüm bot kayıtları
app.get("/bots", async (_req, res) => {
  try {
    const bots = await Bot.find().sort({ updatedAt: -1 });
    res.json(bots);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ----- START -----
app.listen(PORT, () => {
  console.log(`🌍 Halo Crypto Server listening on ${PORT}`);
});