import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// --- MongoDB bağlantısı ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB bağlantısı başarılı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// --- Basit test rotaları ---
app.get("/", (req, res) => {
  res.send("Halo Crypto server aktif 🚀");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// --- DB test için mini model ---
const PingSchema = new mongoose.Schema({ t: { type: Date, default: Date.now } });
const Ping = mongoose.model("Ping", PingSchema);

app.get("/db-test", async (req, res) => {
  try {
    await Ping.create({});
    const count = await Ping.countDocuments();
    res.json({ ok: true, count });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => console.log(`🌐 Server çalışıyor: ${PORT}`));