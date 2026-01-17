const { cmd } = require("../command");
const { ytmp3, ytmp4, tiktok } = require("sadaslk-dlcore");
const yts = require("yt-search");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

/* ================== HELPERS ================== */

async function downloadFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function getYoutube(query) {
  const isUrl = /(youtube\.com|youtu\.be)/i.test(query);

  if (isUrl) {
    const id = query.includes("v=")
      ? query.split("v=")[1].split("&")[0]
      : query.split("/").pop();

    return await yts({ videoId: id });
  }

  const search = await yts(query);
  return search.videos[0];
}

/* ================== SONG ================== */

cmd(
  {
    pattern: "song",
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("Please send a song name or YouTube link.");

      reply("Searching YouTube...");
      const video = await getYoutube(q);
      if (!video) return reply("No results found.");

      reply("Downloading song...");
      const data = await ytmp3(video.url);

      const filePath = path.join(__dirname, `${Date.now()}.mp3`);
      await downloadFile(data.url, filePath);

      await bot.sendMessage(
        from,
        {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
    } catch (e) {
      console.log(e);
      reply("Error while downloading song.");
    }
  }
);

/* ================== VIDEO (FIXED) ================== */

cmd(
  {
    pattern: "video",
    react: "🎬",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("Please send a YouTube link or video name.");

      reply("Searching YouTube...");
      const video = await getYoutube(q);
      if (!video) return reply("No results found.");

      reply("Downloading video (WhatsApp safe)...");
      const data = await ytmp4(video.url, { videoQuality: "360" });

      const filePath = path.join(__dirname, `${Date.now()}.mp4`);
      await downloadFile(data.url, filePath);

      await bot.sendMessage(
        from,
        {
          document: fs.readFileSync(filePath),
          mimetype: "video/mp4",
          fileName: `${video.title}.mp4`,
          caption:
            "YouTube video downloaded successfully.\n" +
            "WhatsApp safe format.\n" +
            "MALIYA-MD ❤️",
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
    } catch (e) {
      console.log(e);
      reply("Error while downloading video.");
    }
  }
);

/* ================== TIKTOK (UNCHANGED) ================== */

cmd(
  {
    pattern: "tiktok",
    react: "🎥",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("Please send a TikTok link.");

      const data = await tiktok(q);
      if (!data?.no_watermark)
        return reply("Failed to download TikTok video.");

      await bot.sendMessage(
        from,
        {
          video: { url: data.no_watermark },
          caption: "TikTok video downloaded successfully.",
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log(e);
      reply("Error while downloading TikTok video.");
    }
  }
);
