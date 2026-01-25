const { cmd } = require("../command");
const axios = require("axios");

// =========================
// 🔑 GEMINI API KEY (TEST)
// =========================
const API_KEY = "AIzaSyDEpXKpIJ3A3UsmytcqA7VGSOst1vX8tow";

// =========================
// ✅ Model candidates (try in order)
// =========================
// Primary: Gemini 2.5 Flash (official docs examples)
// Fallback: "gemini-flash-latest" alias (works in many setups)
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-pro-latest",
];

// =========================
// 🌍 Languages (50)
// =========================
const LANGUAGES = {
  si: "Sinhala", en: "English", ta: "Tamil", hi: "Hindi", ja: "Japanese",
  zh: "Chinese", ko: "Korean", fr: "French", de: "German", es: "Spanish",
  it: "Italian", pt: "Portuguese", ru: "Russian", ar: "Arabic", bn: "Bengali",
  ur: "Urdu", fa: "Persian", tr: "Turkish", nl: "Dutch", sv: "Swedish",
  no: "Norwegian", da: "Danish", fi: "Finnish", pl: "Polish", cs: "Czech",
  ro: "Romanian", hu: "Hungarian", el: "Greek", he: "Hebrew", th: "Thai",
  vi: "Vietnamese", id: "Indonesian", ms: "Malay", tl: "Filipino",
  sw: "Swahili", zu: "Zulu", af: "Afrikaans", uk: "Ukrainian",
  sr: "Serbian", hr: "Croatian", sk: "Slovak", sl: "Slovenian",
  lt: "Lithuanian", lv: "Latvian", et: "Estonian", is: "Icelandic",
  ga: "Irish", mt: "Maltese", km: "Khmer"
};

// =========================
// 🧠 Prompt builder (keep short; English-only bot messages)
// =========================
function buildPrompt(language, topic) {
  let p = `Write a well-structured essay in ${language}. Topic: ${topic}.`;

  if (language === "Sinhala" && /[a-zA-Z]/.test(topic)) {
    p += " The topic may be written in Singlish. Convert it to proper Sinhala first.";
  } else {
    p += " Write only in the requested language.";
  }

  p += " Include introduction, body, and conclusion. Medium length.";
  return p;
}

// =========================
// 🤖 Gemini generateContent with model fallback
// Uses x-goog-api-key header (recommended in docs)
// =========================
async function generateEssay(prompt) {
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
      if (out && out.length > 10) return out;

      lastErr = new Error("Empty response");
    } catch (e) {
      lastErr = e;
      // If model not found, try next candidate
      const status = e?.response?.status;
      if (status !== 404) break; // non-404 errors: stop and report
    }
  }

  throw lastErr || new Error("Unknown Gemini error");
}

// =========================
// Optional: list models command (helps debugging)
// .gemodels
// =========================
cmd(
  {
    pattern: "gemodels",
    desc: "List available Gemini models (first results)",
    category: "AI",
    react: "📜",
    filename: __filename
  },
  async (conn, mek, m, { from, reply }) => {
    try {
      const url = "https://generativelanguage.googleapis.com/v1beta/models";
      const res = await axios.get(url, {
        timeout: 30000,
        headers: { "x-goog-api-key": API_KEY }
      });

      const names = (res?.data?.models || [])
        .map(x => x.name)
        .slice(0, 30);

      if (!names.length) return reply("No models returned by the API.");
      return reply("Available models (first 30):\n\n" + names.join("\n"));
    } catch (e) {
      console.error("GEMODELS ERROR:", e?.response?.data || e?.message || e);
      reply("Failed to list models.");
    }
  }
);

// =========================
// Auto-create commands: .decsi .decen .decja ...
// =========================
Object.entries(LANGUAGES).forEach(([code, language]) => {
  cmd(
    {
      pattern: "dec" + code,
      desc: `Generate an essay in ${language}`,
      category: "AI",
      react: "📝",
      filename: __filename
    },
    async (conn, mek, m, { from, q, reply }) => {
      try {
        if (!q) return reply(`Usage:\n.dec${code} <topic>`);

        await reply(`Generating ${language} essay...`);

        const essay = await generateEssay(buildPrompt(language, q));
        const text = `📝 ${language} Essay\n\nTopic: ${q}\n\n${essay}`;

        await conn.sendMessage(from, { text }, { quoted: mek });
      } catch (err) {
        const status = err?.response?.status;
        console.error("GEMINI ERROR STATUS:", status);
        console.error("GEMINI ERROR:", err?.response?.data || err?.message || err);

        if (status === 404) {
          return reply(
            "Model not found.\nRun .gemodels and use one of the returned models."
          );
        }

        reply("Failed to generate the essay. Please try again later.");
      }
    }
  );
});
