import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ PORT tanımı
const PORT = process.env.PORT || 10000;

// ✅ MongoDB Atlas bağlantısı (senin verdiğin bağlantı)
mongoose
  .connect(
    "mongodb+srv://halocrypto:Halley.117@cluster0.lhafth6.mongodb.net/?appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB Atlas bağlantısı başarılı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// ✅ Mongoose Şeması (Bot durumu)
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

// 🟢 1. Gerçek zamanlı fiyat endpoint’i
app.get("/price", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "symbol gerekli" });

    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const { data } = await axios.get(url);
    res.json({ symbol: data.symbol, price: parseFloat(data.price) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 2. Saatlik SMA endpoint’i (MA9, MA30)
app.get("/sma", async (req, res) => {
  try {
    const { symbol, fast, slow } = req.query;
    if (!symbol) return res.status(400).json({ error: "symbol gerekli" });

    const limit = Math.max(fast || 9, slow || 30);
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`;
    const { data } = await axios.get(url);

    const closes = data.map((d) => parseFloat(d[4]));
    const smaFast =
      closes.slice(-fast).reduce((a, b) => a + b, 0) / parseInt(fast);
    const smaSlow =
      closes.slice(-slow).reduce((a, b) => a + b, 0) / parseInt(slow);

    res.json({ symbol, smaFast, smaSlow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 3. Bot başlatma endpoint’i
app.post("/bot/start", async (req, res) => {
  try {
    const { account, coin, leverage } = req.body;
    if (!account || !coin)
      return res.status(400).json({ error: "Eksik bilgi" });

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 4. Bot durdurma endpoint’i
app.post("/bot/stop", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account)
      return res.status(400).json({ error: "Account bilgisi gerekli" });

    await Bot.updateOne(
      { account },
      { status: "STOPPED", updatedAt: new Date() }
    );
    res.json({ message: "Bot durduruldu ⛔" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 5. Bot durumu görüntüleme
app.get("/bot/status", async (req, res) => {
  try {
    const { account } = req.query;
    if (!account)
      return res.status(400).json({ error: "Account bilgisi gerekli" });

    const bot = await Bot.findOne({ account });
    res.json(bot || { message: "Aktif bot bulunamadı" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 6. Ana kontrol endpoint’i
app.get("/", (req, res) => {
  res.send("🚀 Halo Crypto Server çalışıyor ve MongoDB bağlı!");
});

// ✅ Sunucuyu başlat
app.listen(PORT, () => console.log(`🌐 Server ${PORT} portunda çalışıyor`));