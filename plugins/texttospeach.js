const { cmd } = require("../command");
const axios = require("axios");
const googleTTS = require("google-tts-api");
const fs = require("fs");
const path = require("path");

/* ================= LANGUAGE LIST (20+) ================= */
const LANGS = {
  si: "Sinhala",
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  tr: "Turkish",
  id: "Indonesian",
  th: "Thai",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  bn: "Bengali",
  ur: "Urdu",
  ms: "Malay",
  nl: "Dutch",
  pl: "Polish",
};

/* ================= TRANSLATE ================= */
async function translate(text, targetLang) {
  const res = await axios.get(
    "https://translate.googleapis.com/translate_a/single",
    {
      params: {
        client: "gtx",
        sl: "auto",
        tl: targetLang,
        dt: "t",
        q: text,
      },
      timeout: 15000,
    }
  );

  return (res.data?.[0] || []).map((x) => x?.[0]).join("") || "";
}

/* ================= SEND VOICE ================= */
async function sendVoice(conn, mek, m, text, lang) {
  const outDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `${Date.now()}.mp3`);

  // ✅ Sinhala + many languages supported
  const ttsUrl = googleTTS.getAudioUrl(text, {
    lang,
    slow: false,
    host: "https://translate.google.com",
  });

  // download audio using axios (no fetch)
  const res = await axios.get(ttsUrl, { responseType: "arraybuffer" });
  fs.writeFileSync(outFile, Buffer.from(res.data));

  await conn.sendMessage(
    m.chat,
    {
      audio: fs.readFileSync(outFile),
      mimetype: "audio/mpeg",
      ptt: true, // voice note style
    },
    { quoted: mek }
  );

  fs.unlinkSync(outFile);
}

/* ================= HELP COMMAND ================= */
cmd(
  {
    pattern: "tr",
    alias: ["voice", "tts"],
    desc: "Translate text and send as voice (.tts<lang>)",
    category: "utility",
    react: "🗣️",
    filename: __filename,
  },
  async (conn, mek, m, { reply }) => {
    return reply(
      "🗣️ *Text to Voice*\n\n" +
        "Usage:\n" +
        ".tts<lang> <text>\n\n" +
        "Examples:\n" +
        ".ttssi mama oyata adarei\n" +
        ".ttsen mama oyata adarei\n" +
        ".ttsfr mama oyata adarei\n\n" +
        "Languages:\n" +
        Object.keys(LANGS).join(", ")
    );
  }
);

/* ================= REGISTER ALL .tts<lang> ================= */
for (const code of Object.keys(LANGS)) {
  const langName = LANGS[code];

  cmd(
    {
      pattern: `tts${code}`,        // .ttssi
      alias: [`voice${code}`],      // .voicesi
      desc: `Translate to ${langName} and send voice`,
      category: "utility",
      react: "🗣️",
      filename: __filename,
    },
    async (conn, mek, m, { q, reply }) => {
      try {
        if (!q) {
          return reply(
            `❌ Please provide text.\nExample: .tts${code} hello`
          );
        }

        await reply(`🔄 Translating to ${langName} from MALIYA-MD...`);
        const translated = await translate(q, code);

        if (!translated) {
          return reply("❌ Translation failed. Try again.");
        }

        await reply("🎙️ Generating voice note form MALIYA-MD...");
        await sendVoice(conn, mek, m, translated, code);
      } catch (err) {
        console.error(err);
        reply("❌ Failed (network / TTS error).");
      }
    }
  );
}
