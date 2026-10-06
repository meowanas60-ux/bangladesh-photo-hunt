import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));

// Static website files
app.use(express.static(__dirname));

// Safe public configuration
// এখানে শুধু Supabase URL + Publishable Key যাবে.
// Secret / service_role key কখনো browser-এ পাঠানো হবে না.
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "bangladesh-photo-hunt"
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Photo Hunt running on port ${PORT}`);
});
