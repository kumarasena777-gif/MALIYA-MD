const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ========= ENV (ONLY THIS PLUGIN) =========
const API_KEY = process.env.GEMINI_API_KEY2;
if (!API_KEY) console.error("GEMINI_API_KEY2 is not set (auto_msg plugin)");

// ========= MODELS =========
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-pro-latest",
];

// ========= SETTINGS =========
const PREFIXES = ["."];
const STORE = path.join(process.cwd(), "data", "auto_msg.json");

// 🔒 RATE-LIMIT SAFETY
const COOLDOWN_MS = 15000;          // 15s per chat
const BACKOFF_MS_ON_429 = 180000;   // 3 minutes global pause
const MAX_REPLIES_PER_HOUR = 60;    // global hourly cap

// ========= IDENTITY =========
const IDENTITY_EN =
  "I am MALIYA-MD bot.I am an ai powerd advace bot made by malindu nadith";
const IDENTITY_SI =
  "මම MALIYA-MD bot. මම Malindu Nadith විසින් හදපු AI powered advanced bot එකක්.";

// ========= RATE LIMIT FRIENDLY MSG =========
function rateLimitMsg(lang) {
  return lang === "si"
    ? "⏳ දැන් requests වැඩියි. ටිකක් පස්සේ ආයෙ try කරන්න.\n> MALIYA-MD ❤️"
    : "⏳ Too many requests right now. Please try again in a moment.\n> MALIYA-MD ❤️";
}

// ========= HELP / ABOUT TEXT =========
function helpText(lang) {
  if (lang === "si") {
    return (
`🤖 *MALIYA-MD BOT - Help / Guide*

✅ *Prefix:* .
✅ *Menu:* .menu
✅ *AI Auto Reply (Private only):*
   - ON:  .msg on
   - OFF: .msg off
   - Status: .msg status

📌 *Bot එක use කරන්නෙ කොහොමද?*
1) Command එකක් ඕන නම් "." දාලා type කරන්න.
   උදා: .menu / .ping / .ytmp4 <name> (plugins අනුව වෙනස්)
2) Normal message එකක් (command නෙමෙයි) දුන්නොත්,
   AI auto reply ON තියෙද්දි bot එක reply කරනවා.

🧑‍💻 *Bot Details*
• Name: MALIYA-MD
• Creator: Malindu Nadith
• Type: AI powered advanced WhatsApp bot

ℹ️ *Note:* Groups වලට auto reply නෑ. Commands වලට auto reply නෑ.

> MALIYA-MD ❤️`
    );
  }

  return (
`🤖 *MALIYA-MD BOT - Help / Guide*

✅ *Prefix:* .
✅ *Menu:* .menu
✅ *AI Auto Reply (Private only):*
   - ON:  .msg on
   - OFF: .msg off
   - Status: .msg status

📌 *How to use?*
1) For commands, type with "." prefix.
   Example: .menu / .ping / .ytmp4 <name> (depends on your plugins)
2) For normal messages (not commands),
   if auto reply is ON, the bot will reply.

🧑‍💻 *Bot Details*
• Name: MALIYA-MD
• Creator: Malindu Nadith
• Type: AI powered advanced WhatsApp bot

ℹ️ *Note:* No auto replies in groups. No auto replies for commands.

> MALIYA-MD ❤️`
  );
}

// ========= STORE (GLOBAL) =========
function ensureStore() {
  const dir = path.dirname(STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE)) {
    fs.writeFileSync(STORE, JSON.stringify({ global: { enabled: false } }, null, 2));
  }
}
function readStore() {
  ensureStore();
  try {
    const db = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (!db.global) db.global = { enabled: false };
    return db;
  } catch {
    return { global: { enabled: false } };
  }
}
function writeStore(db) {
  ensureStore();
  fs.writeFileSync(STORE, JSON.stringify(db, null, 2));
}
function setGlobalEnabled(val) {
  const db = readStore();
  db.global.enabled = !!val;
  writeStore(db);
}
function isGlobalEnabled() {
  const db = readStore();
  return !!db.global.enabled;
}

// ========= COOLDOWN =========
const lastReplyAt = new Map();
function inCooldown(chatId) {
  const now = Date.now();
  const last = lastReplyAt.get(chatId) || 0;
  if (now - last < COOLDOWN_MS) return true;
  lastReplyAt.set(chatId, now);
  return false;
}

// ========= HOURLY CAP =========
let hourWindowStart = Date.now();
let repliesThisHour = 0;
function hitHourlyCap() {
  const now = Date.now();
  if (now - hourWindowStart > 3600000) {
    hourWindowStart = now;
    repliesThisHour = 0;
  }
  if (repliesThisHour >= MAX_REPLIES_PER_HOUR) return true;
  repliesThisHour++;
  return false;
}

// ========= BACKOFF =========
let backoffUntil = 0;
function inBackoff() {
  return Date.now() < backoffUntil;
}
function startBackoff() {
  backoffUntil = Date.now() + BACKOFF_MS_ON_429;
}

// ========= QUEUE LOCK =========
let busy = false;

// ========= LANGUAGE DETECT (Sinhala + Singlish) =========
function detectLang(text) {
  if (!text) return "en";
  const t = text.toLowerCase().trim();

  // Sinhala unicode
  if (/[අ-෴]/.test(text)) return "si";

  // Singlish hints => Sinhala reply
  const singlishHints = [
    "oya","kawda","mokada","mokak","kohomada","karanna","puluwan",
    "eka","mage","mata","one","nathi","hari","thawa","denna",
    "kiyala","kiyanne","wedak","wada","balanna","ai","ne","da",
    "thiyenne","thiyanawa","wenne","ganna","haduwe","hadapu",
    "plz","pls","machan","bro","ehema","hariyata"
  ];

  if (singlishHints.some(w => t.includes(w))) return "si";
  return "en";
}

// ========= QUESTION DETECTORS =========
function isIdentityQuestion(text) {
  const t = (text || "").toLowerCase();
  const siKeys = ["oya kawda", "kawda oya", "oyawa haduwe", "haduwe kawda", "me bot eka kawda"];
  const enKeys = ["who are you", "who made you", "who created you", "what are you"];
  return siKeys.some(k => t.includes(k)) || enKeys.some(k => t.includes(k));
}

function isHelpQuestion(text) {
  const t = (text || "").toLowerCase();
  const siKeys = ["help", "menu", "cmd", "commands", "use karanne", "kohomada use", "bot use", "guide", "info"];
  const enKeys = ["help", "menu", "commands", "cmd", "how to use", "guide", "info", "about"];
  // if singlish contains these, it will still match
  return siKeys.some(k => t.includes(k)) || enKeys.some(k => t.includes(k));
}

function getIdentityReply(lang) {
  return lang === "si" ? IDENTITY_SI : IDENTITY_EN;
}

// ========= PROMPT (NO Google/Gemini mention) =========
function buildPrompt(userText, lang) {
  if (lang === "si") {
    return `
ඔබ "MALIYA-MD" bot.
ඔබ Malindu Nadith විසින් හදපු AI powered advanced bot එකක්.
ඔබ ගැන කතා කරද්දි "MALIYA-MD" සහ "Malindu Nadith" විතරක් භාවිතා කරන්න.
පිළිතුරු කෙටි, පැහැදිලි, friendly Sinhalaෙන් දෙන්න.

User: ${userText}
`.trim();
  }

  return `
You are "MALIYA-MD" bot.
You are made by Malindu Nadith.
When referring to yourself, use only "MALIYA-MD" and "Malindu Nadith".
Reply short, clear, and friendly in English.

User: ${userText}
`.trim();
}

// ========= GEMINI CALL =========
async function generateText(prompt) {
  if (!API_KEY) throw new Error("Missing GEMINI_API_KEY2");

  let lastErr = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const res = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY,
          },
        }
      );

      const out = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (out && out.length > 1) return out;

      lastErr = new Error("Empty response");
    } catch (e) {
      lastErr = e;
      if (e?.response?.status === 404) continue;
      throw e;
    }
  }

  throw lastErr || new Error("AI error");
}

// ========= COMMAND: .msg =========
cmd(
  {
    pattern: "msg",
    desc: "Auto Reply ON/OFF (Private chats only)",
    category: "AI",
    react: "💬",
    filename: __filename,
  },
  async (conn, mek, m, { q, reply }) => {
    const arg = (q || "").trim().toLowerCase();

    if (!arg) return reply("Use:\n.msg on\n.msg off\n.msg status");

    if (arg === "on") {
      setGlobalEnabled(true);
      return reply("✅ Auto Reply ON (Private chats only)");
    }

    if (arg === "off") {
      setGlobalEnabled(false);
      return reply("⛔ Auto Reply OFF");
    }

    if (arg === "status") {
      return reply(`Auto Reply: ${isGlobalEnabled() ? "ON" : "OFF"}`);
    }
  }
);

// ========= HOOK =========
async function onMessage(conn, mek, m, ctx = {}) {
  let lang = "en";
  try {
    const from = ctx.from || mek?.key?.remoteJid;
    if (!from) return;

    // ✅ Private chats only
    if (String(from).endsWith("@g.us")) return;

    if (!isGlobalEnabled()) return;
    if (mek?.key?.fromMe) return;

    const body = (ctx.body || "").trim();
    if (!body) return;

    // ignore commands
    if (PREFIXES.some(p => body.startsWith(p))) return;

    lang = detectLang(body);

    // ✅ Help/About (NO API call)
    if (isHelpQuestion(body)) {
      return await conn.sendMessage(from, { text: helpText(lang) }, { quoted: mek });
    }

    // ✅ Identity (NO API call)
    if (isIdentityQuestion(body)) {
      return await conn.sendMessage(from, { text: getIdentityReply(lang) }, { quoted: mek });
    }

    // backoff / queue / caps
    if (inBackoff()) return;
    if (busy) return;
    if (inCooldown(from)) return;
    if (hitHourlyCap()) return;

    busy = true;

    const out = await generateText(buildPrompt(body, lang));
    if (out) await conn.sendMessage(from, { text: out }, { quoted: mek });

  } catch (e) {
    const status = e?.response?.status;

    // ✅ 429 -> friendly small msg + backoff (NO Google/Gemini mention)
    if (status === 429) {
      startBackoff();

      try {
        const from = ctx.from || mek?.key?.remoteJid;
        if (from && !String(from).endsWith("@g.us")) {
          await conn.sendMessage(from, { text: rateLimitMsg(lang) }, { quoted: mek });
        }
      } catch {}

      console.log("AUTO_MSG: rate limit hit (429) - backoff started");
      return;
    }

    console.log("AUTO_MSG ERROR:", status || "", e?.message || e);
  } finally {
    busy = false;
  }
}

module.exports = { onMessage };
