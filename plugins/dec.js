const axios = require("axios");
const { cmd } = require("../command");

const GEMINI_API_KEY = "AIzaSyC1JhddNmClnFQ1KUTRZG3SVEOVCx6uRLE";

const IMAGE_URL =
  "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true";

cmd(
  {
    pattern: "dec",
    react: "📝",
    desc: "Generate Sinhala / English essay",
    category: "ai",
    filename: __filename,
  },
  async (bot, mek, m, { from, q }) => {
    try {
      if (!q) {
        return await bot.sendMessage(
          from,
          { text: "❌ Usage:\n.dec <title>\n.dec en <title>" },
          { quoted: mek }
        );
      }

      let lang = "si";
      let title = q.trim();

      if (q.toLowerCase().startsWith("en ")) {
        lang = "en";
        title = q.slice(3).trim();
      }

      const prompt =
        lang === "en"
          ? `Write a clear English essay about "${title}" with introduction, body paragraphs, and conclusion.`
          : `“${title}” ගැන හොඳින් සංවිධානය කළ සිංහල රචනාවක් ලියන්න. හැඳින්වීම, මූලික අදහස්, සහ නිගමනය ඇතුළත් කරන්න.`;

      const endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
        GEMINI_API_KEY;

      const res = await axios.post(endpoint, {
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text =
        res.data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return await bot.sendMessage(
          from,
          { text: "❌ Gemini returned empty response." },
          { quoted: mek }
        );
      }

      await bot.sendMessage(
        from,
        {
          image: { url: IMAGE_URL },
          caption: `📝 ${lang === "en" ? "Essay" : "රචනාව"}: ${title}\n\n${text.slice(0, 3500)}`,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log("DEC ERROR:", e?.response?.data || e);
      await bot.sendMessage(
        from,
        { text: "❌ Gemini API error. Check API key or model access." },
        { quoted: mek }
      );
    }
  }
);
