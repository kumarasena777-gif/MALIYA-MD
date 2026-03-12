const { cmd } = require("../command");
const yt = require('@vreden/youtube_scraper');
const yts = require("yt-search");

/* ================= HELPERS ================= */

async function getYoutube(query) {
    const isUrl = /(youtube\.com|youtu\.be)/i.test(query);

    if (isUrl) {
        const id = query.includes("v=")
            ? query.split("v=")[1].split("&")[0]
            : query.split("/").pop();
        return await yts({ videoId: id });
    }

    const search = await yts(query);
    return search.videos[0];
}

function generateProgressBar(duration) {
    const totalBars = 10;
    const bar = "─".repeat(totalBars);
    return `*00:00* ${bar}○ *${duration}*`;
}

/* ================= YOUTUBE VIDEO (MP4) ================= */

cmd(
    {
        pattern: "video",
        alias: ["ytmp4", "vdl"],
        react: "🎥",
        category: "download",
        filename: __filename,
    },
    async (bot, mek, m, { from, q, reply }) => {
        try {
            if (!q) return reply("🎥 Please send a video name or YouTube link.");

            reply("🔍 Searching YouTube Video...");
            const video = await getYoutube(q);
            if (!video) return reply("❌ No results found.");

            const duration = video.timestamp || "0:00";
            const progressBar = generateProgressBar(duration);

            // ===== Thumbnail + Details (Same as your song command) =====
            await bot.sendMessage(
                from,
                {
                    image: { url: video.thumbnail },
                    caption: `
🎥 *${video.title}*

👤 *Channel:* ${video.author.name}
⏱ *Duration:* ${duration}
👀 *Views:* ${video.views.toLocaleString()}
📅 *Uploaded:* ${video.ago}

${progressBar}

🍀 *MALIYA-MD VIDEO DOWNLOADER* 🍀
> QUALITY: 360P / 480P STABLE 🎬
                    `,
                },
                { quoted: mek }
            );

            // ===== Download Video using vreden scraper =====
            const search = await yt.ytmp4(video.url); 
            
            if (!search || !search.status) {
                return reply("❌ Failed to fetch download link.");
            }

            // ===== Send Video File =====
            await bot.sendMessage(
                from,
                {
                    video: { url: search.download },
                    mimetype: "video/mp4",
                    caption: `✅ ${video.title}\n\n*MALIYA-MD ❤️*`
                },
                { quoted: mek }
            );

        } catch (e) {
            console.log(e);
            reply("❌ Error while downloading video: " + e.message);
        }
    }
);
