const { cmd } = require("../command");
const { ytmp4 } = require("sadaslk-dlcore");
const yts = require("yt-search");

async function getYoutube(query) {
    const isUrl = /(youtube\.com|youtu\.be)/i.test(query);
    if (isUrl) {
        const id = query.split("v=")[1] || query.split("/").pop();
        const info = await yts({ videoId: id });
        return info;
    }
    const search = await yts(query);
    if (!search.videos.length) return null;
    return search.videos[0];
}

cmd({
    pattern: "ytmp4",
    alias: ["ytv", "video"],
    desc: "Download YouTube video as MP4",
    category: "download",
    filename: __filename,
},
async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("*❌ Please give me a YouTube link or video name*");
        
        reply("*⏳ Searching your video...*");
        const video = await getYoutube(q);
        if (!video) return reply("*❌ Video not found*");
        
        await bot.sendMessage(from, {
            image: { url: video.thumbnail },
            caption: `*📌 ${video.title}*\n\n*⏱ Duration:* ${video.timestamp}\n*👤 Channel:* ${video.author.name}\n*👀 Views:* ${video.views}\n\n*⬇️ Downloading video...*`
        }, { quoted: mek });
        
        const download = await ytmp4(video.url);
        
        if (download && download.url) {
            await bot.sendMessage(from, {
                video: { url: download.url },
                mimetype: "video/mp4",
                caption: `*✅ Video downloaded*\n\n*📌 ${video.title}*`
            }, { quoted: mek });
        } else {
            reply("*❌ Download failed*");
        }
        
    } catch (e) {
        console.log(e);
        reply("*❌ Error: " + e.message + "*");
    }
});
