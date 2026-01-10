const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("❌ *Song name එකක් දෙන්න*");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ *Song හම්බුනේ නෑ*");

      const caption = `🎵 *${data.title}*
⏱️ ${data.timestamp}
👁️ ${data.views.toLocaleString()} views
📅 ${data.ago}

👇 *File type එක select කරන්න*`;

      // 🔹 BUTTON MESSAGE
      await bot.sendMessage(
        from,
        {
          image: { url: data.thumbnail },
          caption,
          footer: "MALIYA‑MD 🎧",
          buttons: [
            {
              buttonId: `song_audio|${data.url}`,
              buttonText: { displayText: "🎧 Get Audio" },
              type: 1,
            },
            {
              buttonId: `song_doc|${data.url}`,
              buttonText: { displayText: "📄 Get Document" },
              type: 1,
            },
          ],
          headerType: 4,
        },
        { quoted: mek }
      );

    } catch (e) {
      console.log(e);
      reply("❌ Error occurred");
    }
  }
);

// 🔹 BUTTON HANDLER
cmd(
  {
    filter: (text) =>
      text.startsWith("song_audio|") || text.startsWith("song_doc|"),
  },
  async (bot, mek, m, { from, body, reply }) => {
    try {
      const [type, url] = body.split("|");
      const quality = "192";
      const songData = await ytmp3(url, quality);

      if (type === "song_audio") {
        await bot.sendMessage(
          from,
          {
            audio: { url: songData.download.url },
            mimetype: "audio/mpeg",
          },
          { quoted: mek }
        );
      }

      if (type === "song_doc") {
        await bot.sendMessage(
          from,
          {
            document: { url: songData.download.url },
            mimetype: "audio/mpeg",
            fileName: "song.mp3",
          },
          { quoted: mek }
        );
      }

    } catch (e) {
      console.log(e);
      reply("❌ Download failed");
    }
  }
);
