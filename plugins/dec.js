const axios = require("axios");
const { cmd } = require("../command");

const IMAGE_URL =
  "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true";

function buildEssay(lang, title, summary, extract2 = "") {
  // summary = first paragraph, extract2 = extra content
  const intro = summary?.trim() || "";
  const more = extract2?.trim() || "";

  if (lang === "en") {
    return [
      `📝 *ESSAY*: ${title}`,
      ``,
      `*Introduction*`,
      intro || "No summary found on Wikipedia.",
      ``,
      `*Main Points*`,
      more || "Try a more specific title (e.g., add a year, place, or full name).",
      ``,
      `*Conclusion*`,
      `In conclusion, ${title} is an important topic, and the information above provides a clear overview based on Wikipedia sources.`
    ].join("\n");
  }

  // Sinhala (essay style)
  return [
    `📝 *රචනාව*: ${title}`,
    ``,
    `*හැඳින්වීම*`,
    intro || "Wikipedia වලින් සාරාංශයක් ලබාගැනීමට නොහැකි විය. කරුණාකර වෙනත් මාතෘකාවක් උත්සාහ කරන්න.",
    ``,
    `*ප්‍රධාන කරුණු*`,
    more || "මාතෘකාව තවත් පැහැදිලි කරලා බලන්න (නම/අවුරුද්ද/තැනක් එක්කරලා).",
    ``,
    `*නිගමනය*`,
    `නිගමනයක් ලෙස, ${title} පිළිබඳ ඉහත සටහන Wikipedia තොරතුරු මත පදනම්ව සරලව හා පැහැදිලිව ඉදිරිපත් කළ හැකිය.`
  ].join("\n");
}

async function wikiFetch(lang, title) {
  // 1) Search best match
  const searchUrl = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(
    title
  )}&limit=1`;

  const s = await axios.get(searchUrl, { timeout: 30000 });
  const page = s?.data?.pages?.[0];
  if (!page?.key) return null;

  // 2) Get summary
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    page.key
  )}`;

  const sum = await axios.get(summaryUrl, { timeout: 30000 });
  const summary = sum?.data?.extract || "";
  const displayTitle = sum?.data?.title || title;

  // 3) Get more content (plain text)
  // Using "extracts" API for longer intro-ish text
  const extraUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&format=json&titles=${encodeURIComponent(
    displayTitle
  )}`;

  const extra = await axios.get(extraUrl, { timeout: 30000 });
  const pages = extra?.data?.query?.pages || {};
  const firstPageId = Object.keys(pages)[0];
  const extractAll = pages[firstPageId]?.extract || "";

  // Take a reasonable chunk after first paragraph
  const extract2 = extractAll.split("\n").slice(1, 8).join("\n").trim(); // few paragraphs

  return { displayTitle, summary, extract2 };
}

cmd(
  {
    pattern: "dec",
    react: "📚",
    desc: "Generate Sinhala/English essay using Wikipedia (no API key)",
    category: "info",
    filename: __filename,
  },
  async (bot, mek, m, { from, q }) => {
    try {
      if (!q || !q.trim()) {
        return await bot.sendMessage(
          from,
          { text: "❌ Usage:\n.dec <මාතෘකාව>\n.dec en <title>" },
          { quoted: mek }
        );
      }

      let lang = "si";
      let title = q.trim();

      if (q.toLowerCase().startsWith("en ")) {
        lang = "en";
        title = q.slice(3).trim();
      }

      // Fallback: Sinhala Wikipedia sometimes lacks pages; if empty, try English
      const result = await wikiFetch(lang, title);

      if (!result) {
        return await bot.sendMessage(
          from,
          { text: "❌ Wikipedia page not found. Try a different title." },
          { quoted: mek }
        );
      }

      let { displayTitle, summary, extract2 } = result;

      // If Sinhala requested but empty summary, try English as backup (optional)
      if (lang === "si" && (!summary || summary.length < 20)) {
        const enTry = await wikiFetch("en", title);
        if (enTry?.summary) {
          displayTitle = enTry.displayTitle;
          summary = enTry.summary;
          extract2 = enTry.extract2;
        }
      }

      const essay = buildEssay(lang, displayTitle, summary, extract2);

      // WhatsApp caption safe limit
      const MAX = 3500;
      const caption = essay.length > MAX ? essay.slice(0, MAX) + "\n\n...(trimmed)" : essay;

      await bot.sendMessage(
        from,
        {
          image: { url: IMAGE_URL },
          caption,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log("DEC WIKI ERROR:", e?.response?.data || e?.message || e);
      await bot.sendMessage(
        from,
        { text: "❌ Wikipedia error. Check internet connection and try again." },
        { quoted: mek }
      );
    }
  }
);
