// ====== DEPENDENCIES ======
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

// ====== APP CONFIG ======
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://halocrypto:Halley.117@cluster0.lhafth6.mongodb.net/HaloCryptoDB?retryWrites=true&w=majority";

// ====== CONNECT TO MONGODB ======
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB bağlantısı başarılı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err.message));

// ====== SCHEMAS ======

// Demo hesap şeması
const DemoAccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  balance: { type: Number, default: 1000 },
  createdAt: { type: Date, default: Date.now },
});
const DemoAccount = mongoose.model("DemoAccount", DemoAccountSchema);

// Bot şeması
const BotSchema = new mongoose.Schema({
  account: { type: String, required: true },
  coin: { type: String, required: true },
  leverage: { type: Number, default: 1 },
  status: { type: String, default: "STOPPED" },
  entryPrice: { type: Number, default: 0 },
  pnl: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
const Bot = mongoose.model("Bot", BotSchema);

// ====== ROUTES ======

// Sağlık kontrolü
app.get("/", (_req, res) => {
  res.send("🚀 Halo Crypto Server çalışıyor!");
});

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
    if (!name) return res.status(400).json({ error: "Hesap adı gerekli" });

    const count = await DemoAccount.countDocuments();
    if (count >= 10)
      return res.status(400).json({ error: "Maksimum 10 hesap oluşturulabilir" });

    const account = new DemoAccount({ name, balance: balance || 1000 });
    await account.save();
    res.status(201).json(account);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Demo hesabı sil
app.delete("/api/demoAccounts/:id", async (req, res) => {
  try {
    await DemoAccount.findByIdAndDelete(req.params.id);
    res.json({ message: "Hesap silindi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Binance fiyat verisi
app.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol parametresi gerekli" });

    const { data } = await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    );

    res.json({
      symbol: data.symbol,
      price: parseFloat(data.price),
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SMA verileri
app.get("/sma", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    const fast = parseInt(req.query.fast || "9");
    const slow = parseInt(req.query.slow || "30");
    if (!symbol) return res.status(400).json({ error: "symbol parametresi gerekli" });

    const limit = Math.max(fast, slow, 30);
    const { data } = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`
    );

    const closes = data.map((k) => parseFloat(k[4]));
    const smaFast = closes.slice(-fast).reduce((a, b) => a + b, 0) / fast;
    const smaSlow = closes.slice(-slow).reduce((a, b) => a + b, 0) / slow;

    res.json({
      symbol,
      smaFast: Number(smaFast.toFixed(2)),
      smaSlow: Number(smaSlow.toFixed(2)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot başlat
app.post("/bot/start", async (req, res) => {
  try {
    const { account, coin, leverage = 1 } = req.body;
    if (!account || !coin)
      return res.status(400).json({ error: "account ve coin gerekli" });

    const bot = await Bot.findOneAndUpdate(
      { account },
      {
        account,
        coin: coin.toUpperCase(),
        leverage: Number(leverage),
        status: "RUNNING",
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    res.json({ message: "Bot başlatıldı", bot });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot durdur
app.post("/bot/stop", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) return res.status(400).json({ error: "account gerekli" });

    await Bot.updateOne({ account }, { status: "STOPPED", updatedAt: new Date() });
    res.json({ message: "Bot durduruldu" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot durumu
app.get("/bot/status", async (req, res) => {
  try {
    const account = String(req.query.account || "");
    if (!account) return res.status(400).json({ error: "account gerekli" });

    const bot = await Bot.findOne({ account });
    res.json(bot || { message: "Bu hesaba ait bot bulunamadı" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🌍 Halo Crypto Server aktif, port: ${PORT}`);
});