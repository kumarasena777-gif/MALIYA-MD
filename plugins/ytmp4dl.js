const { cmd } = require('../command');
const yt = require('@vreden/youtube_scraper');

cmd({
    pattern: "video",
    alias: ["ytmp4", "downloadvideo"],
    desc: "YouTube වෙතින් වීඩියෝ Download කිරීමට",
    category: "download",
    react: "🎥",
    filename: __filename
},
async (sock, mek, m, { from, args, q, reply }) => {
    try {
        if (!q) return reply("කරුණාකර YouTube Link එකක් හෝ වීඩියෝවේ නම ලබා දෙන්න. 📲\n\nඋදා: .video https://youtu.be/xxxx");

        await reply("සැකසෙමින් පවතී, කරුණාකර රැඳී සිටින්න... ⏳");

        // 1. YouTube Scraper එකෙන් දත්ත ලබා ගැනීම
        // මෙතනදී 360p quality එක default දාලා තියෙන්නේ
        const search = await yt.ytmp4(q, '360'); 

        if (!search || !search.status) {
            return reply("කණගාටුයි, එම වීඩියෝව සොයා ගැනීමට නොහැකි වුණා. ❌");
        }

        const data = search.metadata;
        const downloadUrl = search.download;

        // 2. වීඩියෝ විස්තර සහිත caption එකක් හැදීම
        let desc = `
🎥 *MALIYA-MD VIDEO DOWNLOADER* 🎥

📌 *Title:* ${data.title}
👤 *Channel:* ${data.author || 'N/A'}
⏱️ *Duration:* ${data.timestamp || 'N/A'}
🔗 *Link:* ${q}

🚀 *Downloading...*
        `.trim();

        // 3. මුලින්ම Thumbnail එක සමඟ විස්තර යැවීම
        await sock.sendMessage(from, { 
            image: { url: data.thumbnail }, 
            caption: desc 
        }, { quoted: mek });

        // 4. වීඩියෝ එක File එකක් විදිහට සෙන්ඩ් කිරීම
        await sock.sendMessage(from, { 
            video: { url: downloadUrl }, 
            mimetype: 'video/mp4',
            caption: `✅ ${data.title}\n\n*Powered by MALIYA-MD*`
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply("දෝෂයක් සිදු වුණා: " + e.message);
    }
});
