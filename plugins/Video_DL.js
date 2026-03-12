const { cmd } = require("../command");
const Scrap = require("@dark-yasiya/scrap");

// Support both constructor export and plain object export
const dy_scrap =
  typeof Scrap === "function"
    ? new Scrap()
    : Scrap.default
    ? new Scrap.default()
    : Scrap;

// Progress Bar Generator
function generateProgressBar(duration = "0:00") {
  const totalBars = 10;
  const bar = "─".repeat(totalBars);
  return `*00:00* ${bar}○ *${duration}*`;
}

cmd(
  {
    pattern: "video",
    alias: ["ytmp4", "vdl"],
    react: "🎥",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🎥 Please provide a YouTube link or video name.");

      await reply("🔍 Searching Video...");

      // Check method exists
      if (!dy_scrap || typeof dy_scrap.ytsearch !== "function") {
        return reply("❌ Scrap module not loaded correctly.");
      }

      const search = await dy_scrap.ytsearch(q);

      if (!search || !search.results || !Array.isArray(search.results) || !search.results.length) {
        return reply("❌ No results found.");
      }

      const video = search.results[0];
      const title = video?.title || "Unknown Title";
      const thumbnail = video?.thumbnail || video?.image || null;
      const duration = video?.timestamp || "0:00";
      const channel = video?.author?.name || "Unknown Channel";
      const views = video?.views ? Number(video.views).toLocaleString() : "Unknown";
      const uploaded = video?.ago || "Unknown";
      const videoUrl = video?.url;

      if (!videoUrl) {
        return reply("❌ Video URL not found.");
      }

      const progressBar = generateProgressBar(duration);

      if (thumbnail) {
        await bot.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption: `🎥 *${title}*

👤 *Channel:* ${channel}
⏱ *Duration:* ${duration}
👀 *Views:* ${views}
📅 *Uploaded:* ${uploaded}

${progressBar}

🍀 *MALIYA-MD VIDEO DOWNLOADER* 🍀
> QUALITY: 360P STABLE 🎬`
          },
          { quoted: mek }
        );
      } else {
        await reply(`🎥 *${title}*\n\n👤 *Channel:* ${channel}\n⏱ *Duration:* ${duration}\n👀 *Views:* ${views}\n📅 *Uploaded:* ${uploaded}`);
      }

      if (typeof dy_scrap.ytmp4 !== "function") {
        return reply("❌ ytmp4 method not found in scrap module.");
      }

      const data = await dy_scrap.ytmp4(videoUrl, 360);

      const downloadUrl = data?.result?.download?.url;
      if (!data?.status || !downloadUrl) {
        return reply("❌ Failed to fetch video download link.");
      }

      await bot.sendMessage(
        from,
        {
          video: { url: downloadUrl },
          mimetype: "video/mp4",
          caption: `✅ *${title}*\n\n*MALIYA-MD ❤️*`,
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("VIDEO CMD ERROR:", e);
      return reply("❌ Error while downloading video:\n" + e.message);
    }
  }
);
