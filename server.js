import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ""
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bangladesh-photo-hunt" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Photo Hunt running on port ${PORT}`);
});
