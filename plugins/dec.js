const fetch = require("node-fetch");

module.exports = {
  pattern: "dec",
  desc: "Generate Sinhala/English essay using Gemini",
  category: "ai",
  react: "📝",
  filename: __filename

  async execute(bot, m, args) {
    try {
      // ✅ Put your Gemini API key here (No ENV needed)
      const GEMINI_API_KEY = "AIzaSyC1JhddNmClnFQ1KUTRZG3SVEOVCx6uRLE";

      // ✅ Your image link (raw)
      const IMAGE_URL =
        "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true";

      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PASTE_YOUR")) {
        return m.reply("❌ Gemini API key not set. Please paste your API key inside the plugin.");
      }

      if (!args || args.length === 0) {
        return m.reply(
          "❌ Title missing.\n\n✅ Usage:\n.dec <title>\n.dec en <title>\n\nExample:\n.dec ශ්‍රී ලංකාවේ සංස්කෘතිය\n.dec en The Importance of Education"
        );
      }

      // ---- Language command handling ----
      // .dec en My title
      // .dec si මගේ මාතෘකාව
      let lang = "si";
      let title = args.join(" ").trim();

      const first = (args[0] || "").toLowerCase();
      if (first === "en" || first === "si") {
        lang = first;
        title = args.slice(1).join(" ").trim();
      }

      if (!title) {
        return m.reply("❌ Please provide a valid title after language.\nExample: .dec en My Title");
      }

      // ---- Prompt ----
      const prompt =
        lang === "en"
          ? `Write a well-structured English essay about: "${title}". 
Include: introduction, 3-5 body paragraphs with clear points, and a conclusion. 
Keep it clear, school-friendly, and informative.`
          : `මෙම මාතෘකාව ගැන හොඳින් සංවිධානය කළ සිංහල රචනාවක් ලියන්න: "${title}". 
අවශ්‍ය ලෙස: හැඳින්වීම, මූලික අදහස් 3-5 පරිච්ඡේද, සහ අවසාන නිගමනය. 
සරල, පැහැදිලි, ශිෂ්‍ය මට්ටමට ගැලපෙන විදිහට ලියන්න.`;

      // ---- Gemini API call (generative-language REST) ----
      // Using: models/gemini-1.5-flash (fast & good for text)
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 900
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Gemini API error:", res.status, errText);
        return m.reply("❌ Gemini API error. Please check your API key or try again.");
      }

      const data = await res.json();

      const out =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() ||
        "❌ No text received from Gemini.";

      // ---- Caption trimming (WhatsApp caption limits can be strict) ----
      // Safer to limit caption length
      const MAX = 3500;
      const finalText =
        out.length > MAX ? out.slice(0, MAX) + "\n\n...(trimmed)" : out;

      const caption =
        `📝 *${lang === "en" ? "Essay" : "රචනාව"}* : ${title}\n\n` + finalText;

      // ✅ Send as image + caption using your link
      await bot.sendMessage(
        m.from,
        {
          image: { url: IMAGE_URL },
          caption
        },
        { quoted: m }
      );
    } catch (e) {
      console.error(e);
      m.reply("❌ Error while generating essay.");
    }
  }
};
