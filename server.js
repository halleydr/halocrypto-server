import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// === AYARLAR ===
const PORT = process.env.PORT || 10000;
const MONGO_URI = "mongodb+srv://halocrypto:Halley.117@cluster0.lhafth6.mongodb.net/?appName=Cluster0";

// === MONGODB BAĞLANTISI ===
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB bağlantısı başarılı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// === ŞEMA ===
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

// === ENDPOINTLER ===

// 🟢 Ana test endpoint
app.get("/", (req, res) => {
  res.send("🚀 Halo Crypto Server çalışıyor (v2.0) ve MongoDB bağlı!");
});

// 🟢 1. Fiyat Endpoint
app.get("/price", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "symbol gerekli" });
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    res.json({
      symbol: response.data.symbol,
      price: parseFloat(response.data.price),
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 2. SMA (MA9 / MA30)
app.get("/sma", async (req, res) => {
  try {
    const { symbol, fast = 9, slow = 30 } = req.query;
    if (!symbol) return res.status(400).json({ error: "symbol gerekli" });

    const limit = Math.max(parseInt(fast), parseInt(slow));
    const { data } = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`
    );

    const closes = data.map((k) => parseFloat(k[4]));
    const smaFast = closes.slice(-fast).reduce((a, b) => a + b, 0) / fast;
    const smaSlow = closes.slice(-slow).reduce((a, b) => a + b, 0) / slow;

    res.json({
      symbol,
      smaFast: parseFloat(smaFast.toFixed(2)),
      smaSlow: parseFloat(smaSlow.toFixed(2)),
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 3. BOT BAŞLAT
app.post("/bot/start", async (req, res) => {
  try {
    const { account, coin, leverage = 1 } = req.body;
    if (!account || !coin) return res.status(400).json({ error: "Eksik bilgi" });

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
    res.json({ message: "Bot başlatıldı ✅", bot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 4. BOT DURDUR
app.post("/bot/stop", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) return res.status(400).json({ error: "Account gerekli" });

    await Bot.updateOne(
      { account },
      { status: "STOPPED", updatedAt: new Date() }
    );

    res.json({ message: "Bot durduruldu ⛔" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 5. BOT DURUMU
app.get("/bot/status", async (req, res) => {
  try {
    const { account } = req.query;
    if (!account) return res.status(400).json({ error: "Account gerekli" });

    const bot = await Bot.findOne({ account });
    res.json(bot || { message: "Bot bulunamadı" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 6. Tüm bot kayıtlarını listele (test için)
app.get("/bots", async (req, res) => {
  try {
    const bots = await Bot.find().sort({ updatedAt: -1 });
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SUNUCU ===
app.listen(PORT, () => {
  console.log(`🌍 Halo Crypto Server ${PORT} portunda çalışıyor...`);
});