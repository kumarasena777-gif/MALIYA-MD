const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "tiktok",
    alias: ["ttdl", "tt", "tiktokdl"],
    desc: "Download TikTok video without watermark",
    category: "downloader",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Please provide a TikTok video link.");
        if (!q.includes("tiktok.com") && !q.includes("vm.tiktok.com")) 
            return reply("❌ Invalid TikTok link.");

        await reply("⏳ Downloading video, please wait...");

        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${q}`;
        const { data } = await axios.get(apiUrl);

        if (!data || !data.status || !data.data) 
            return reply("❌ Failed to fetch TikTok video.");

        const { title, like, comment, share, author, meta } = data.data;

        const videoObj = meta?.media?.find(v => v.type === "video");
        if (!videoObj || !videoObj.org) return reply("❌ Video not found in API response.");
        const videoUrl = videoObj.org;

        const caption = `🎵 *TikTok Video* 🎵\n\n` +
                        `👤 *User:* ${author.nickname} (@${author.username})\n` +
                        `📖 *Title:* ${title}\n` +
                        `👍 *Likes:* ${like}\n💬 *Comments:* ${comment}\n🔁 *Shares:* ${share}`;

        // Send video
        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: caption,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: mek });

        // Send ending thank you message
        await reply("✨ *_Thanks for using MALIYA-MD_* ✨");

    } catch (e) {
        console.error("Error in TikTok downloader command:", e);
        reply(`⚠️ An error occurred: ${e.message}`);
    }
});
