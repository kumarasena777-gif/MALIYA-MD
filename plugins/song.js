const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download song with buttons",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("❌ *Song name or YouTube link ekak denna*");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ *Song ekak hoyaganna bari una*");

      const url = data.url;

      const caption =
`🎵 *${data.title}*

⏱️ Duration: ${data.timestamp}
👀 Views: ${data.views.toLocaleString()}
📅 Uploaded: ${data.ago}

⬇️ *Button ekak click karala download karanna*`;

      // 🔘 Buttons message
      await bot.sendMessage(from, {
        image: { url: data.thumbnail },
        caption,
        buttons: [
          {
            buttonId: `.songaudio ${url}`,
            buttonText: { displayText: "🎧 Audio (MP3)" },
            type: 1
          },
          {
            buttonId: `.songdoc ${url}`,
            buttonText: { displayText: "📁 Document (MP3)" },
            type: 1
          }
        ],
        headerType: 4
      }, { quoted: mek });

    } catch (e) {
      console.log(e);
      reply("❌ Error occurred");
    }
  }
);

/* ===============================
   AUDIO BUTTON HANDLER
================================ */
cmd(
  { pattern: "songaudio", dontAddCommandList: true },
  async (bot, mek, m, { from, args, reply }) => {
    try {
      const url = args[0];
      if (!url) return;

      const songData = await ytmp3(url, "192");

      await bot.sendMessage(from, {
        audio: { url: songData.download.url },
        mimetype: "audio/mpeg"
      }, { quoted: mek });

    } catch (e) {
      reply("❌ Audio download error");
    }
  }
);

/* ===============================
   DOCUMENT BUTTON HANDLER
================================ */
cmd(
  { pattern: "songdoc", dontAddCommandList: true },
  async (bot, mek, m, { from, args, reply }) => {
    try {
      const url = args[0];
      if (!url) return;

      const songData = await ytmp3(url, "192");

      await bot.sendMessage(from, {
        document: { url: songData.download.url },
        mimetype: "audio/mpeg",
        fileName: "song.mp3"
      }, { quoted: mek });

    } catch (e) {
      reply("❌ Document download error");
    }
  }
);
