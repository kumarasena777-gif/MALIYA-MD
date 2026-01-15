const axios = require("axios");
const { cmd } = require("../command");

// API Key එක මෙතැනට දාන්න (නැතිනම් process.env.GEMINI_API_KEY ලෙස භාවිතා කරන්න)
const GEMINI_API_KEY = "AIzaSyC1JhddNmClnFQ1KUTRZG3SVEOVCx6uRLE"; 

const IMAGE_URL = "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true";

cmd(
    {
        pattern: "dec",
        react: "📝",
        desc: "Generate Sinhala / English essay using Gemini AI",
        category: "ai",
        filename: __filename,
    },
    async (bot, mek, m, { from, q, reply }) => {
        try {
            if (!q) {
                return await reply("❌ භාවිතය:\n.dec <මාතෘකාව>\n.dec en <Title>");
            }

            let lang = "si";
            let title = q.trim();

            if (q.toLowerCase().startsWith("en ")) {
                lang = "en";
                title = q.slice(3).trim();
            }

            const prompt = lang === "en" 
                ? `Write a structured English essay about "${title}". Include an Introduction, Body paragraphs, and a Conclusion.` 
                : `"${title}" යන මාතෘකාව යටතේ ඉතා හොඳින් සංවිධානය කරන ලද සිංහල රචනාවක් ලියන්න. මෙහි හැඳින්වීම, කරුණු පැහැදිලි කරන ඡේද සහ නිගමනය ඇතුළත් විය යුතුය.`;

            // Stable V1 Endpoint එක භාවිතා කිරීම වඩාත් සුදුසුයි
            const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            const res = await axios.post(endpoint, {
                contents: [{ parts: [{ text: prompt }] }],
            });

            // Data ලැබී ඇත්දැයි පරීක්ෂාව
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                return await reply("❌ කණගාටුයි, පිළිතුරක් ලබා ගැනීමට නොහැකි විය. (AI Blocked or Empty)");
            }

            await bot.sendMessage(
                from,
                {
                    image: { url: IMAGE_URL },
                    caption: `📝 *${lang === "en" ? "ESSAY" : "රචනාව"}* : ${title}\n\n${text}`,
                },
                { quoted: mek }
            );

        } catch (e) {
            console.error("DEC ERROR:", e.response ? e.response.data : e.message);
            await reply("❌ Gemini API දෝෂයකි. කරුණාකර API Key එක හෝ අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.");
        }
    }
);
