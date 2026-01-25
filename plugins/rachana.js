const { cmd } = require("../command");
const axios = require("axios");

// =========================
// 🔑 GEMINI API KEY (TEST)
// =========================
const API_KEY = "AIzaSyDEpXKpIJ3A3UsmytcqA7VGSOst1vX8tow";

// =========================
// ✅ FIXED MODEL NAME
// =========================
// Try flash first. If you still get 404, switch to "gemini-1.5-pro-001".
const GEMINI_MODEL = "gemini-1.5-flash-001";

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

async function generateEssay(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  const res = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }]
    },
    { timeout: 30000 }
  );

  return res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

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
        if (!essay) throw new Error("Empty response from Gemini");

        const text = `📝 ${language} Essay\n\nTopic: ${q}\n\n${essay}`;
        await conn.sendMessage(from, { text }, { quoted: mek });

      } catch (err) {
        const status = err?.response?.status;
        const data = err?.response?.data;

        console.error("GEMINI STATUS:", status);
        console.error("GEMINI DATA:", data || err?.message || err);

        // Helpful hint for 404 model errors
        if (status === 404) {
          return reply(
            "Model not found for this API version.\n" +
            "Edit GEMINI_MODEL to 'gemini-1.5-pro-001' (or list models) and try again."
          );
        }

        reply("Failed to generate the essay. Please try again later.");
      }
    }
  );
});
