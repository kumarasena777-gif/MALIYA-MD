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
  async (maliya, mek, m, { from, reply, q }) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link*");

      // Search video
      const search = await yts(q);
      if (!search.videos || search.videos.length === 0)
        return reply("*❌ No results found!*");

      const data = search.videos[0];
      const url = data.url;

      // Send thumbnail + info first
      const desc = `
🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}
👀 *Views:* ${data.views.toLocaleString()}
🔗 *Watch Here:* ${data.url}
`;

      await maliya.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Limit duration to 30 min
      let durationParts = data.timestamp.split(":").map(Number);
      const totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800)
        return reply("⏳ *Sorry, audio files longer than 30 minutes are not supported.*");

      // Download audio
      const quality = "192";
      const songData = await ytmp3(url, quality);

      if (!songData || !songData.download || !songData.download.url)
        return reply("*❌ Failed to fetch song download link.*");

      // Send audio safely
      await maliya.sendMessage(
        from,
        {
          audio: { url: songData.download.url },
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
        },
        { quoted: mek }
      );

      return reply(
        "✅ *Song downloaded successfully!* 🎶\n\n" +
          "*🎧 Enjoy your music!*\n" +
          "*👤 Creator:* Malindu Nadith\n\n" +
          "🙏 Thanks for using *_MALIYA-MD_*"
      );
    } catch (e) {
      console.log(e);
      reply(`❌ *Error:* ${e.message} 😞`);
    }
  }
);
