const { cmd } = require("../command");
const YTDlpWrap = require("yt-dlp-wrap").default;
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");

const ytdlp = new YTDlpWrap();

function isYouTubeUrl(text = "") {
  return /youtu\.be\/|youtube\.com\/(watch\?v=|shorts\/|live\/)/i.test(text);
}

cmd(
  {
    pattern: "ch",
    alias: ["ytv", "ytvideo"],
    desc: "Download YouTube video as MP4 (by name or link)",
    category: "download",
    react: "🎬",
    filename: __filename,
  },
  async (conn, mek, m, { q, reply }) => {
    try {
      if (!q) {
        return reply(
          "❌ Please provide a YouTube link or video name.\n\nExamples:\n.ytmp4 despacito\n.ytmp4 https://youtu.be/xxxx"
        );
      }

      let url = q.trim();
      let title = "YouTube Video";

      // 🔎 If input is NOT a link → search by name
      if (!isYouTubeUrl(url)) {
        reply("🔎 Searching YouTube...");
        const search = await yts(url);
        const video = search?.videos?.[0];

        if (!video || !video.url) {
          return reply("❌ No results found. Please try another name.");
        }

        url = video.url;
        title = video.title;
      }

      const outDir = path.join(__dirname, "../tmp");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

      const outFile = path.join(outDir, `${Date.now()}.mp4`);

      reply("⏬ Downloading video, please wait...");

      await ytdlp.exec([
        url,
        "-f", "bv*+ba/best",
        "--merge-output-format", "mp4",
        "-o", outFile,
      ]);

      await conn.sendMessage(
        m.chat,
        {
          video: fs.readFileSync(outFile),
          caption:
            `🎬 *YouTube MP4 Downloaded*\n\n` +
            `📌 Title: ${title}\n` +
            `⚡ Powered by MALIYA-MD`,
        },
        { quoted: mek }
      );

      fs.unlinkSync(outFile);
    } catch (err) {
      console.error(err);
      reply(
        "❌ Download failed.\nPossible reasons:\n- Video is too large\n- Age restricted\n- Private video"
      );
    }
  }
);
