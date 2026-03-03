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
const MEMORY_STORE = path.join(process.cwd(), "data", "auto_msg_memory.json");

// 🔒 RATE-LIMIT SAFETY
const COOLDOWN_MS = 15000;          // 15s per chat
const BACKOFF_MS_ON_429 = 180000;   // 3 minutes global pause
const MAX_REPLIES_PER_HOUR = 60;    // global hourly cap

// 🧠 MEMORY SETTINGS
const MEMORY_MAX_PER_CHAT = 250;     // keep last 250 Q/A per chat
const MEMORY_TTL_DAYS = 60;          // delete older than 60 days
const MEMORY_MIN_CHARS = 3;          // ignore super short
const SIM_THRESHOLD = 0.84;          // 0.84+ => similar enough (tune if needed)

// 🧩 CONTEXT SETTINGS
const CONTEXT_MAX_TURNS = 6; // last (user+bot)*3

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

// ========= MEMORY STORE =========
function ensureMemoryStore() {
  const dir = path.dirname(MEMORY_STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MEMORY_STORE)) {
    fs.writeFileSync(MEMORY_STORE, JSON.stringify({ chats: {}, context: {} }, null, 2));
  }
}
function readMemory() {
  ensureMemoryStore();
  try {
    const db = JSON.parse(fs.readFileSync(MEMORY_STORE, "utf8"));
    if (!db.chats) db.chats = {};
    if (!db.context) db.context = {};
    return db;
  } catch {
    return { chats: {}, context: {} };
  }
}
function writeMemory(db) {
  ensureMemoryStore();
  fs.writeFileSync(MEMORY_STORE, JSON.stringify(db, null, 2));
}

function pruneQA(items) {
  const now = Date.now();
  const ttlMs = MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000;

  items = (items || []).filter(x => (now - (x.ts || now)) <= ttlMs);
  if (items.length > MEMORY_MAX_PER_CHAT) {
    items = items.slice(items.length - MEMORY_MAX_PER_CHAT);
  }
  return items;
}

function saveQA(chatId, q, a) {
  const db = readMemory();
  if (!db.chats[chatId]) db.chats[chatId] = [];
  db.chats[chatId].push({ q, a, ts: Date.now() });
  db.chats[chatId] = pruneQA(db.chats[chatId]);
  writeMemory(db);
}

function getChatMemory(chatId) {
  const db = readMemory();
  db.chats[chatId] = pruneQA(db.chats[chatId] || []);
  writeMemory(db);
  return db.chats[chatId];
}

// ---- CONTEXT (last turns) ----
function saveTurn(chatId, role, text) {
  const db = readMemory();
  if (!db.context) db.context = {};
  if (!db.context[chatId]) db.context[chatId] = [];

  db.context[chatId].push({ role, text: String(text || ""), ts: Date.now() });

  if (db.context[chatId].length > CONTEXT_MAX_TURNS) {
    db.context[chatId] = db.context[chatId].slice(db.context[chatId].length - CONTEXT_MAX_TURNS);
  }
  writeMemory(db);
}

function getContext(chatId) {
  const db = readMemory();
  const ctx = (db.context && db.context[chatId]) ? db.context[chatId] : [];
  return ctx;
}

// ========= SIMPLE SIMILARITY (NO DEP) =========
function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(s) {
  const t = normalizeText(s);
  if (!t) return [];
  return t.split(" ").filter(Boolean);
}
// Jaccard similarity on tokens (0..1)
function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;

  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function findBestMemoryAnswer(chatId, userText) {
  const qn = normalizeText(userText);
  if (!qn || qn.length < MEMORY_MIN_CHARS) return null;

  const items = getChatMemory(chatId);
  let best = null;
  let bestScore = 0;

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const sc = similarity(qn, it.q);
    if (sc > bestScore) {
      bestScore = sc;
      best = it;
      if (bestScore >= 0.98) break;
    }
  }

  if (best && bestScore >= SIM_THRESHOLD) {
    return { answer: best.a, score: bestScore };
  }
  return null;
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

// ========= FOLLOW-UP DETECT =========
function isFollowUp(text) {
  const t = normalizeText(text);

  if (t.length <= 14) return true;

  const keys = [
    "eka","eeka","ehema","ehama","ow","an","ai","ehenam",
    "meka","mokakda","kohomada","hari","ok","okay","thawa",
    "why","how","what about","then","so","explain"
  ];
  return keys.some(k => t === k || t.includes(k));
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

function buildPromptWithContext(userText, lang, contextTurns) {
  const history = (contextTurns || [])
    .map(x => `${x.role === "user" ? "User" : "Bot"}: ${x.text}`)
    .join("\n");

  if (lang === "si") {
    return `
ඔබ "MALIYA-MD" bot.
ඔබ Malindu Nadith විසින් හදපු AI powered advanced bot එකක්.
ඔබ ගැන කතා කරද්දි "MALIYA-MD" සහ "Malindu Nadith" විතරක් භාවිතා කරන්න.
පිළිතුරු කෙටි, පැහැදිලි, friendly Sinhalaෙන් දෙන්න.
නමුත් හැම වෙලාවේම සහ වැඩිපුර MALIYA-MD කියන එක සහ Malindu Nadith කියන එක භාවිතා නොකරන්න 

මෙන්න පෙර chat context:
${history || "(no context)"}

දැන් User අහන්නේ:
${userText}
`.trim();
  }

  return `
You are "MALIYA-MD" bot, made by Malindu Nadith.
Use only "MALIYA-MD" and "Malindu Nadith" when referring to yourself.
Reply short, clear, friendly in English.
But don't use MALIYA-MD and Malindu Nadith all the time and too much.

Previous chat context:
${history || "(no context)"}

Now the user asks:
${userText}
`.trim();
}

// ========= AI CALL =========
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

    // ✅ Save user turn (context)
    saveTurn(from, "user", body);

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

    // ✅ 1) MEMORY CHECK FIRST (NO API)
    const mem = findBestMemoryAnswer(from, body);
    if (mem?.answer) {
      // save bot turn too (context)
      saveTurn(from, "bot", mem.answer);
      return await conn.sendMessage(from, { text: mem.answer }, { quoted: mek });
    }

    // ✅ 2) IF NOT FOUND -> API CALL (context-aware for follow-up)
    busy = true;

    const ctxTurns = getContext(from);
    const prompt = isFollowUp(body)
      ? buildPromptWithContext(body, lang, ctxTurns)
      : buildPrompt(body, lang);

    const out = await generateText(prompt);

    if (out) {
      await conn.sendMessage(from, { text: out }, { quoted: mek });

      // save Q/A so next time no API
      saveQA(from, normalizeText(body), out);

      // save context
      saveTurn(from, "bot", out);
    }

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
