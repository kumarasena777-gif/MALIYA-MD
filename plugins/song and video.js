const { cmd } = require("../command");
const { ytmp3, ytmp4, tiktok } = require("sadaslk-dlcore");
const yts = require("yt-search");

/**
 * Get YouTube video info by name or link
 */
async function getYoutube(query) {
  const isUrl = /(youtube\.com|youtu\.be)/i.test(query);

  if (isUrl) {
    const id = query.includes("v=")
      ? query.split("v=")[1].split("&")[0]
      : query.split("/").pop();

    const info = await yts({ videoId: id });
    return info;
  }

  const search = await yts(query);
  if (!search.videos || search.videos.length === 0) return null;

  return search.videos[0];
}

/* ===================== SONG (MP3) ===================== */

cmd(
  {
    pattern: "song",
    alias: ["yta", "ytmp3"],
    desc: "Download YouTube song (MP3)",
    category: "download",
    react: "🎵",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q)
        return reply("🎵 Please send a song name or YouTube link.");

      reply("🔎 Searching on YouTube...");

      const video = await getYoutube(q);
      if (!video) return reply("❌ No song found.");

      await bot.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption:
            `🎵 *${video.title}*\n\n` +
            `👤 Channel: ${video.author.name}\n` +
            `⏱ Duration: ${video.timestamp}`,
        },
        { quoted: mek }
      );

      reply("⬇️ Downloading song (MP3)...");

      const data = await ytmp3(video.url);
      if (!data || !data.url)
        return reply("❌ Failed to download the song.");

      await bot.sendMessage(
        from,
        {
          audio: { url: data.url },
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );
    } catch (err) {
      console.log("YTMP3 ERROR:", err);
      reply("❌ An error occurred while downloading the song.");
    }
  }
);

/* ===================== VIDEO (MP4) ===================== */

cmd(
  {
    pattern: "video",
    alias: ["ytv", "ytmp4", "vid"],
    desc: "Download YouTube video (WhatsApp safe)",
    category: "download",
    react: "🎬",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q)
        return reply("🎬 Please send a YouTube link or video name.");

      reply("🔎 Searching on YouTube...");

      const video = await getYoutube(q);
      if (!video) return reply("❌ No video found.");

      await bot.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption:
            `🎬 *${video.title}*\n\n` +
            `👤 Channel: ${video.author.name}\n` +
            `⏱ Duration: ${video.timestamp}`,
        },
        { quoted: mek }
      );

      reply("⬇️ Downloading video Using MALIYA-MD...");

      const data = await ytmp4(video.url, {
        format: "mp4",
        videoQuality: "360",
      });

      if (!data || !data.url)
        return reply("❌ Failed to download the video.");

      // Send as document (NO WhatsApp error)
      await bot.sendMessage(
        from,
        {
          document: { url: data.url },
          mimetype: "video/mp4",
          fileName: `${video.title}.mp4`,
          caption:
            "🎬 YouTube video downloaded successfully!\n" +
            "✅ WhatsApp supported format\n" +
            "Thanks for using *MALIYA-MD* ❤️",
        },
        { quoted: mek }
      );
    } catch (err) {
      console.log("YTMP4 ERROR:", err);
      reply("❌ An error occurred while downloading the video.");
    }
  }
);

/* ===================== TIKTOK ===================== */

cmd(
  {
    pattern: "tiktok",
    alias: ["tt", "ttdl"],
    desc: "Download TikTok video (No watermark)",
    category: "download",
    react: "🎥",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q)
        return reply("📱 Please send a TikTok video link.");

      reply("⬇️ Downloading TikTok video...");

      const data = await tiktok(q);
      if (!data || !data.no_watermark)
        return reply("❌ Failed to download TikTok video.");

      await bot.sendMessage(
        from,
        {
          video: { url: data.no_watermark },
          caption:
            "🎥 TikTok video downloaded successfully!\n" +
            "Thanks for using *MALIYA-MD* ❤️",
        },
        { quoted: mek }
      );
    } catch (err) {
      console.log("TIKTOK ERROR:", err);
      reply("❌ An error occurred while downloading TikTok video.");
    }
  }
);
