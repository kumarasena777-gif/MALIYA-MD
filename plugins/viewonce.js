const { cmd } = require("../command");

cmd({
    pattern: "vv",
    alias: ["viewonce", "retrieve"],
    desc: "Convert view once media to normal media",
    category: "tools",
    react: "🔓",
    filename: __filename
},
async (bot, mek, m, { from, reply, quoted }) => {
    try {
        // Reply කර ඇති පණිවිඩය ලබා ගැනීම
        let target = m.quoted ? m.quoted : m;
        
        // View Once දත්ත තිබේදැයි විවිධ ක්‍රම වලට පරීක්ෂා කිරීම
        const msg = target.message?.viewOnceMessageV2?.message || 
                    target.message?.viewOnceMessage?.message || 
                    target.message?.viewOnceMessageV2Extension?.message ||
                    target.message;

        // එය image හෝ video එකක්දැයි බැලීම
        const isImage = msg?.imageMessage ? true : false;
        const isVideo = msg?.videoMessage ? true : false;
        const isViewOnce = msg?.imageMessage?.viewOnce || msg?.videoMessage?.viewOnce || target.msg?.viewOnce;

        if (!isImage && !isVideo) {
            return reply("❌ Please reply to a *View Once* photo or video.");
        }

        // මීඩියා එක Download කිරීම
        let buffer = await target.download();

        if (!buffer) return reply("❌ Could not download the media.");

        const caption = `*🔓 View Once Unlocked By MALIYA-MD*\n\n*Type:* ${isImage ? 'Image 📸' : 'Video 🎥'}\n*Sender:* @${target.sender.split('@')[0]}`;

        if (isImage) {
            await bot.sendMessage(from, { image: buffer, caption: caption, mentions: [target.sender] }, { quoted: mek });
        } else if (isVideo) {
            await bot.sendMessage(from, { video: buffer, caption: caption, mentions: [target.sender] }, { quoted: mek });
        }

    } catch (e) {
        console.error("VV ERROR:", e);
        reply("❌ Error: Make sure you are replying to a View Once message.");
    }
});
