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
  async (bot, mek, m, { from, body, q, reply }) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link*");

      // Search YouTube
      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ *No results found!*");

      // Song info
      const desc = `
🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
👀 *Views:* ${data.views.toLocaleString()}
🔗 *Watch:* ${data.url}
      `;

      // Prepare buttons
      const buttons = [
        {
          buttonId: `getSong|${data.url}`,
          buttonText: { displayText: "🎵 Get Song" },
          type: 1,
        },
      ];

      const buttonMessage = {
        image: { url: data.thumbnail },
        caption: desc,
        footer: "MALIYA-MD Bot 🎶",
        buttons: buttons,
        headerType: 4, // 4 = image header
      };

      await bot.sendMessage(from, buttonMessage, { quoted: mek });
    } catch (e) {
      console.log(e);
      reply(`❌ *Error:* ${e.message}`);
    }
  }
);

// Separate handler for button click
cmd(
  {
    pattern: "getSong",
    desc: "Download song from button",
    filename: __filename,
    category: "download",
  },
  async (bot, mek, m, { from, body, args, reply }) => {
    try {
      const url = args[0];
      if (!url) return reply("❌ *URL not found!*");

      const quality = "192";
      const songData = await ytmp3(url, quality);

      await bot.sendMessage(from, {
        document: { url: songData.download.url },
        mimetype: "audio/mpeg",
        fileName: `${songData.title}.mp3`,
        caption: "🎶 *Here is your song!*",
      });
    } catch (e) {
      console.log(e);
      reply(`❌ *Error:* ${e.message}`);
    }
  }
);
