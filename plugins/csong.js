const { cmd } = require("../command");
const { ytmp3 } = require("sadaslk-dlcore");
const yts = require("yt-search");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

/* ================= STORAGE ================= */

const STORE_PATH = path.join(__dirname, "csong_targets.json");

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { groups: [] };
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8") || '{"groups":[]}');
  } catch {
    return { groups: [] };
  }
}

function writeStore(obj) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2));
}

function isGroupJid(jid = "") {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

/* ================= HELPERS ================= */

async function downloadFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const res = await axios({ url, method: "GET", responseType: "stream" });
  res.data.pipe(writer);
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
    const r = await yts({ videoId: id });
    return r?.title ? r : null;
  }
  const search = await yts(query);
  return search.videos?.[0];
}

function generateProgressBar(duration) {
  const totalBars = 10;
  const bar = "─".repeat(totalBars);
  return `*00:00* ${bar}○ *${duration}*`;
}

async function getGroupName(bot, jid) {
  try {
    const meta = await bot.groupMetadata(jid);
    return meta?.subject || jid;
  } catch {
    return jid;
  }
}

function makeBeautifulCaption(video, extraLine = "") {
  const title = video?.title || "Unknown Title";
  const channel = video?.author?.name || "Unknown";
  const duration = video?.timestamp || "0:00";
  const views = Number(video?.views || 0).toLocaleString();
  const uploaded = video?.ago || "Unknown";
  const progressBar = generateProgressBar(duration);

  return `
🎵 *${title}*

👤 *Channel:* ${channel}
⏱ *Duration:* ${duration}
👀 *Views:* ${views}
📅 *Uploaded:* ${uploaded}

${progressBar}

🍀 *ENJOY YOUR SONG* 🍀
> USE HEADPHONES FOR THE BEST EXPERIENCE 🎧🎧🎧🎧🎧🎧🎧
${extraLine ? `\n${extraLine}` : ""}
  `.trim();
}

async function sendSongToGroup(bot, quoted, target, video) {
  // 1) Thumbnail + full caption
  await bot.sendMessage(
    target,
    {
      image: { url: video.thumbnail },
      caption: makeBeautifulCaption(video),
    },
    { quoted }
  );

  // 2) MP3
  const data = await ytmp3(video.url);
  if (!data?.url) throw new Error("MP3 download failed (missing url).");

  const filePath = path.join(__dirname, `${Date.now()}.mp3`);
  await downloadFile(data.url, filePath);

  await bot.sendMessage(
    target,
    {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      fileName: `${video.title}.mp3`,
    },
    { quoted }
  );

  fs.unlinkSync(filePath);
}

/* ================= PENDING ================= */

const pending = {}; // pending[user] = { video, groups, from }

/* ================= SAVE GROUP ================= */

cmd(
  { pattern: "ctarget", react: "🎯", category: "config", filename: __filename },
  async (bot, mek, m, { from, reply }) => {
    try {
      if (!isGroupJid(from)) return reply("Use this command inside a group.");

      const store = readStore();
      if (!store.groups.includes(from)) {
        store.groups.push(from);
        writeStore(store);
      }

      const name = await getGroupName(bot, from);
      reply(`Saved target group: *${name}*`);
    } catch (e) {
      console.log(e);
      reply("Error saving target group.");
    }
  }
);

/* ================= CSONG (PREVIEW -> SELECT -> SEND) ================= */

cmd(
  { pattern: "csong", react: "🎵", category: "download", filename: __filename },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      const store = readStore();
      if (!store.groups.length) return reply("No target groups saved. Use .ctarget inside a group first.");
      if (!q) return reply("Please provide a song name or YouTube link.");

      // Search once
      const video = await getYoutube(q);
      if (!video) return reply("No results found.");

      // Beautiful preview (ONLY in command chat)
      await bot.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: makeBeautifulCaption(video, "Reply with a group number to send, or reply *0* to cancel."),
        },
        { quoted: mek }
      );

      // If only one group saved, send directly
      if (store.groups.length === 1) {
        await sendSongToGroup(bot, mek, store.groups[0], video);
        return reply("Sent to the saved target group.");
      }

      // Multi groups: show list
      const names = await Promise.all(store.groups.map((g) => getGroupName(bot, g)));
      const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n");

      pending[mek.sender] = { video, groups: store.groups, from };

      return reply(`Select a target group number (1-${store.groups.length}) or send 0 to cancel:\n\n${list}`);
    } catch (e) {
      console.log(e);
      reply("Error while processing the song.");
    }
  }
);

/* ================= NUMBER SELECT (0 CANCEL) ================= */

cmd(
  { pattern: "^(\\d+)$", react: "✅", category: "download", filename: __filename },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      const p = pending[mek.sender];
      if (!p) return; // no pending selection
      if (p.from !== from) return; // must select in same chat

      const num = parseInt(q.trim(), 10);

      if (num === 0) {
        delete pending[mek.sender];
        return reply("Cancelled.");
      }

      if (num < 1 || num > p.groups.length) {
        return reply(`Invalid number. Send 1-${p.groups.length}, or 0 to cancel.`);
      }

      const target = p.groups[num - 1];

      await sendSongToGroup(bot, mek, target, p.video);

      delete pending[mek.sender];
      return reply("Sent successfully.");
    } catch (e) {
      console.log(e);
      reply("Error while sending the song.");
    }
  }
);
