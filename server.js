import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "bangladesh-photo-hunt"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Photo Hunt running on port ${PORT}`);
});
