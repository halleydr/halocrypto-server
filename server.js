import express from "express";
const app = express();

app.get("/", (req, res) => res.send("Halo Crypto Server aktif!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
