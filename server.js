import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB bağlantısı
mongoose.connect("YOUR_MONGODB_ATLAS_URL", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Model: bot durumu
const BotSchema = new mongoose.Schema({
  account: String,
  coin: String,
  leverage: Number,
  status: String,
  entryPrice: Number,
  pnl: Number,
  updatedAt: Date,
});
const Bot = mongoose.model("Bot", BotSchema);

// 🟢 1. Fiyat endpoint'i
app.get("/price", async (req, res) => {
  try {
    const { symbol } = req.query;
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 2. SMA endpoint'i
app.get("/sma", async (req, res) => {
  try {
    const { symbol, fast, slow } = req.query;
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${Math.max(fast, slow)}`;
    const { data } = await axios.get(url);
    const closes = data.map((d) => parseFloat(d[4]));
    const smaFast = closes.slice(-fast).reduce((a, b) => a + b, 0) / fast;
    const smaSlow = closes.slice(-slow).reduce((a, b) => a + b, 0) / slow;
    res.json({ smaFast, smaSlow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 3. Bot başlatma endpoint'i
app.post("/bot/start", async (req, res) => {
  try {
    const { account, coin, leverage } = req.body;
    const bot = new Bot({
      account,
      coin,
      leverage,
      status: "RUNNING",
      entryPrice: 0,
      pnl: 0,
      updatedAt: new Date(),
    });
    await bot.save();
    res.json({ message: "Bot started", bot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 4. Bot durdurma endpoint'i
app.post("/bot/stop", async (req, res) => {
  try {
    const { account } = req.body;
    await Bot.updateOne({ account }, { status: "STOPPED", updatedAt: new Date() });
    res.json({ message: "Bot stopped" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 5. Bot durumu görüntüleme endpoint'i
app.get("/bot/status", async (req, res) => {
  try {
    const { account } = req.query;
    const bot = await Bot.findOne({ account });
    res.json(bot || { message: "No active bot found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 6. Ana rota kontrol
app.get("/", (req, res) => {
  res.send("Halo Crypto Server aktif ✅");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));