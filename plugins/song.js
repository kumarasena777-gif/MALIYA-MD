const { cmd } = require("../command");
const yts = require("yt-search");

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
      if (!q) return reply("❌ Please provide a song name");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ Song not found");

      global.songCache = global.songCache || {};
      global.songCache[from] = {
        url: data.url,
        title: data.title,
      };

      // 1️⃣ Image + Details
      await bot.sendMessage(
        from,
        {
          image: { url: data.thumbnail },
          caption:
            `🎵 *Title:* ${data.title}\n` +
            `⏱️ *Duration:* ${data.timestamp}\n` +
            `👀 *Views:* ${data.views.toLocaleString()}\n` +
            `📅 *Uploaded:* ${data.ago}`,
        },
        { quoted: mek }
      );

      // 2️⃣ LIST BUTTON MESSAGE
      await bot.sendMessage(
        from,
        {
          listMessage: {
            title: "🎶 SONG DOWNLOAD",
            description: "Select download type",
            buttonText: "Click Here ↴",
            sections: [
              {
                title: "DOWNLOAD OPTIONS",
                rows: [
                  {
                    title: "🎧 Get Audio File",
                    description: "MP3 audio",
                    rowId: "song_audio",
                  },
                  {
                    title: "📁 Get Document File",
                    description: "MP3 document",
                    rowId: "song_doc",
                  },
                ],
              },
            ],
          },
        },
        { quoted: mek }
      );
    } catch (e) {
      reply("❌ Error occurred");
    }
  }
);
