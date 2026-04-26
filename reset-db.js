/**
 * reset-db.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Har raat 12:00 AM (midnight IST) pe db.json ko original snapshot se
 * restore karta hai. json-server ke saath parallel mein chalao.
 *
 * Setup (ek baar):
 *   cp db.json db.snapshot.json     ← original snapshot banana (kabhi mat badlein)
 *
 * Chalane ke liye:
 *   Terminal 1:  npx json-server db.json --port 5000
 *   Terminal 2:  node reset-db.js
 *
 * Ya ek command se (package.json mein add karein):
 *   npm install --save-dev concurrently
 *   "start": "concurrently \"npx json-server db.json --port 5000\" \"node reset-db.js\""
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname ES modules mein directly nahi milta, ye workaround hai
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SNAPSHOT = path.join(__dirname, "db.snapshot.json");
const TARGET   = path.join(__dirname, "db.json");

// ── Snapshot check ────────────────────────────────────────────────────────────
if (!fs.existsSync(SNAPSHOT)) {
  console.error("❌  db.snapshot.json not found!");
  console.error("    Pehle ye command chalao:");
  console.error("    cp db.json db.snapshot.json");
  process.exit(1);
}

// ── Reset function ────────────────────────────────────────────────────────────
function resetDb() {
  try {
    const snapshot = fs.readFileSync(SNAPSHOT, "utf8");
    fs.writeFileSync(TARGET, snapshot, "utf8");
    const now = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true,
    });
    console.log(`✅  [${now} IST] db.json reset to original snapshot.`);
    scheduleNextReset(); // agle din ke liye schedule karo
  } catch (err) {
    console.error("❌  Reset failed:", err.message);
    scheduleNextReset(); // fail hone par bhi agle din try karo
  }
}

// ── Calculate ms until next 12:00 AM IST ─────────────────────────────────────
function msUntilMidnightIST() {
  const now = new Date();

  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    istFormatter.formatToParts(now).map(p => [p.type, p.value])
  );

  // Agle din ka midnight IST = UTC mein 18:30 UTC (usi din)
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  const tomorrowMidnightUTC = new Date(
    Date.UTC(
      parseInt(parts.year),
      parseInt(parts.month) - 1,
      parseInt(parts.day) + 1, // next day
      0, 0, 0, 0               // 00:00:00.000 IST time
    ) - IST_OFFSET_MS           // UTC equivalent
  );

  return tomorrowMidnightUTC.getTime() - now.getTime();
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function scheduleNextReset() {
  const ms  = msUntilMidnightIST();
  const hrs = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);

  const nextReset = new Date(Date.now() + ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  });

  console.log(`⏰  Next reset: ${nextReset} IST  (in ${hrs}h ${min}m ${sec}s)`);
  setTimeout(resetDb, ms);
}

// ── Start ─────────────────────────────────────────────────────────────────────
console.log("🔄  DB Auto-Reset service started.");
console.log("    Resets automatically every night at 12:00 AM IST.\n");
scheduleNextReset();