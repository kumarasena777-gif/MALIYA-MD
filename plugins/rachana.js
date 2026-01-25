// plugins/dec.js
// 50-language essay generator (.decsi, .decen, .decta, etc.)
// English-only bot messages + strong error logging + retry + safe prompt length

const { cmd } = require("../command");
const axios = require("axios");

// 50 useful languages
const LANGUAGES = {
  si: "Sinhala",
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  bn: "Bengali",
  ur: "Urdu",
  fa: "Persian",
  tr: "Turkish",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  pl: "Polish",
  cs: "Czech",
  ro: "Romanian",
  hu: "Hungarian",
  el: "Greek",
  he: "Hebrew",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  tl: "Filipino",
  sw: "Swahili",
  zu: "Zulu",
  af: "Afrikaans",
  uk: "Ukrainian",
  sr: "Serbian",
  hr: "Croatian",
  sk: "Slovak",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  is: "Icelandic",
  ga: "Irish",
  mt: "Maltese",
  km: "Khmer",
};

// Your current endpoint (keep as primary)
const ENDPOINTS = [
  "https://lance-frank-asta.onrender.com/api/gpt",
  // Add your backup endpoint(s) here if you have
  // "https://your-backup.com/api/gpt",
];

const AXIOS_TIMEOUT_MS = 25000;
const RETRIES_PER_ENDPOINT = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Keep prompts short to avoid URL too long issues (GET query length limits).
function buildPrompt(language, topic) {
  const hasLatin = /[a-zA-Z]/.test(topic);

  // Short + strict prompt
  let prompt = `Write an essay in ${language}. Topic: ${topic}.`;

  // Extra instruction (still short)
  if (language === "Sinhala" && hasLatin) {
    prompt += " The topic may be Singlish; convert it to proper Sinhala first.";
  } else if (language !== "Sinhala") {
    prompt += " Write only in the requested language.";
  }

  // Ask for structure, but keep short
  prompt += " Include introduction, body, and conclusion. Medium length.";

  return prompt;
}

function cleanText(x) {
  if (!x || typeof x !== "string") return "";
  return x.trim();
}

async function callGet(endpoint, prompt) {
  const url = `${endpoint}?q=${encodeURIComponent(prompt)}`;
  const res = await axios.get(url, { timeout: AXIOS_TIMEOUT_MS });
  return cleanText(res?.data?.message);
}

// Some APIs support POST { q: prompt }. We try POST as fallback.
// If not supported, it will throw (405/404) and we'll handle it.
async function callPost(endpoint, prompt) {
  const res = await axios.post(
    endpoint,
    { q: prompt },
    {
      timeout: AXIOS_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    }
  );
  return cleanText(res?.data?.message);
}

function isTimeout(err) {
  const msg = String(err?.message || "").toLowerCase();
  return err?.code === "ECONNABORTED" || msg.includes("timeout");
}

function pickReason(err) {
  const status = err?.response?.status;
  const msg = String(err?.message || "");
  if (isTimeout(err)) return "Request timed out (API is slow/down).";
  if (status === 414) return "Request too long (URL too long).";
  if (status) return `API returned status ${status}.`;
  if (err?.code) return `Network error: ${err.code}.`;
  if (msg) return `Error: ${msg}`;
  return "Unknown error.";
}

function logFullError(err) {
  // Clean + useful logs (not circular object spam)
  const status = err?.response?.status;
  const code = err?.code;
  const msg = err?.message;
  const data = err?.response?.data;

  console.log("DEC ERROR STATUS:", status);
  console.log("DEC ERROR CODE:", code);
  console.log("DEC ERROR MESSAGE:", msg);
  if (data) console.log("DEC ERROR DATA:", data);
}

async function generateEssay(prompt) {
  let lastErr = null;

  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt <= RETRIES_PER_ENDPOINT; attempt++) {
      try {
        // Try GET first (most likely supported)
        let out = await callGet(endpoint, prompt);

        // If empty or too short, try POST once (some servers return empty for long GETs)
        if (!out || out.length < 20) {
          try {
            out = await callPost(endpoint, prompt);
          } catch (e) {
            // Ignore POST failure if not supported
          }
        }

        if (out && out.length >= 20) return out;

        lastErr = new Error("Empty/invalid response from API");
      } catch (err) {
        lastErr = err;

        // If URL too long, POST is the best fallback (try immediately)
        if (err?.response?.status === 414) {
          try {
            const out = await callPost(endpoint, prompt);
            if (out && out.length >= 20) return out;
          } catch (e) {
            lastErr = e;
          }
        }

        // wait before retry
        await sleep(1200);
      }
    }
  }

  throw lastErr || new Error("Unknown API error");
}

// Create commands: .decsi .decen .decta ...
Object.entries(LANGUAGES).forEach(([code, language]) => {
  cmd(
    {
      pattern: "dec" + code,
      desc: `Generate an essay in ${language}`,
      category: "AI",
      react: "📝",
      filename: __filename,
    },
    async (conn, mek, m, { from, q, reply }) => {
      try {
        if (!q) {
          return reply(
            `Usage:\n.dec${code} <topic>\nExample:\n.dec${code} The beauty of Sri Lanka`
          );
        }

        await reply(`Generating ${language} essay...`);

        const prompt = buildPrompt(language, q);
        const essay = await generateEssay(prompt);

        const text = `📝 ${language} Essay\n\nTopic: ${q}\n\n${essay}`;
        await conn.sendMessage(from, { text }, { quoted: mek });
      } catch (err) {
        logFullError(err);
        const reason = pickReason(err);
        return reply(
          `Failed to generate the essay.\nReason: ${reason}\nPlease try again later.`
        );
      }
    }
  );
});
