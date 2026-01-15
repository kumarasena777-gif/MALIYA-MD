const axios = require("axios");
const { cmd } = require("../command");

// ✅ Put your REAL API KEY here
const GEMINI_API_KEY = "AIzaSyC1JhddNmClnFQ1KUTRZG3SVEOVCx6uRLE";

const IMAGE_URL =
  "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true";

cmd(
  {
    pattern: "dec",
    react: "📝",
    desc: "Generate Sinhala / English essay using Gemini AI",
    category: "ai",
    filename: __filename,
  },
  async (bot, mek, m, ctx) => {
    const { from, q } = ctx || {};

    // ✅ Safe reply function (works even if ctx.reply doesn't exist)
    const sendText = async (text) => {
      if (ctx?.reply) return ctx.reply(text);
      if (m?.reply) return m.reply(text);
      return bot.sendMessage(from, { text }, { quoted: mek });
    };

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PASTE_YOUR")) {
        return await sendText("❌ Gemini API key not set. Please paste your API key inside dec.js");
      }

      if (!q || !q.trim()) {
        return await sendText("❌ Usage:\n.dec <මාතෘකාව>\n.dec en <Title>");
      }

      let lang = "si";
      let title = q.trim();

      if (q.toLowerCase().startsWith("en ")) {
        lang = "en";
        title = q.slice(3).trim();
      }

      if (!title) return await sendText("❌ Invalid title.");

      const prompt =
        lang === "en"
          ? `Write a structured English essay about "${title}". Include an Introduction, Body paragraphs, and a Conclusion.`
          : `"${title}" යන මාතෘකාව යටතේ ඉතා හොඳින් සංවිධානය කළ සිංහල රචනාවක් ලියන්න. හැඳින්වීම, කරුණු පැහැදිලි කරන ඡේද, සහ නිගමනය ඇතුළත් විය යුතුය.`;

      const endpoint =
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
          GEMINI_API_KEY
        )}`;

      const res = await axios.post(
        endpoint,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { "Content-Type": "application/json" }, timeout: 60000 }
      );

      const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        console.log("Gemini empty response:", res.data);
        return await sendText("❌ Sorry, Gemini returned empty response (blocked/empty).");
      }

      // ✅ WhatsApp caption safe limit
      const MAX = 3500;
      const out = text.length > MAX ? text.slice(0, MAX) + "\n\n...(trimmed)" : text;

      await bot.sendMessage(
        from,
        {
          image: { url: IMAGE_URL },
          caption: `📝 *${lang === "en" ? "ESSAY" : "රචනාව"}* : ${title}\n\n${out}`,
        },
        { quoted: mek }
      );
    } catch (e) {
      const errData = e?.response?.data;
      console.error("DEC ERROR:", errData || e?.message || e);

      // ✅ show useful error to you (owner) + simple msg to user
      const status = e?.response?.status;
      const msg = errData?.error?.message || e?.message || "Unknown error";

      await sendText(`❌ Gemini API error.\nStatus: ${status || "?"}\nMessage: ${msg}`);
    }
  }
);
