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

async function safeGroupName(bot, jid) {
  try {
    const meta = await bot.groupMetadata(jid);
    return meta?.subject || jid;
  } catch {
    return jid;
  }
}

async function sendSongToGroup(bot, mek, targetJid, video, reply) {
  // 1) Thumbnail + info (ONLY to target group)
  const duration = video.timestamp || "0:00";
  const progressBar = generateProgressBar(duration);

  await bot.sendMessage(
    targetJid,
    {
      image: { url: video.thumbnail },
      caption: `
🎵 *${video.title}*

👤 Channel: ${video.author?.name || "Unknown"}
⏱ Duration: ${duration}
👀 Views: ${Number(video.views || 0).toLocaleString()}
📅 Uploaded: ${video.ago || "Unknown"}

${progressBar}

🍀 ENJOY YOUR SONG 🍀
> USE HEADPHONES FOR THE BEST EXPERIENCE 🎧🎧🎧🎧🎧🎧🎧
      `.trim(),
    },
    { quoted: mek }
  );

  // 2) Download mp3 then send (ONLY to target group)
  const data = await ytmp3(video.url);
  if (!data?.url) throw new Error("MP3 download failed (missing url).");

  const filePath = path.join(__dirname, `${Date.now()}.mp3`);
  await downloadFile(data.url, filePath);

  await bot.sendMessage(
    targetJid,
    {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      fileName: `${video.title}.mp3`,
    },
    { quoted: mek }
  );

  fs.unlinkSync(filePath);
}

/* ================= PENDING SELECTION (in-memory) ================= */
/**
 * pending[userJid] = {
 *   chat: fromWhereSelectionHappens,
 *   video: youtubeVideoObject,
 *   groups: [jid1, jid2, ...],
 *   createdAt: Date.now()
 * }
 */
const pending = {};
const PENDING_TTL_MS = 2 * 60 * 1000; // 2 minutes

function cleanupPending() {
  const now = Date.now();
  for (const k of Object.keys(pending)) {
    if (!pending[k] || now - pending[k].createdAt > PENDING_TTL_MS) delete pending[k];
  }
}
setInterval(cleanupPending, 30 * 1000).unref?.();

/* ================= 1) SAVE TARGET GROUP ================= */
/**
 * Use inside a group:
 * .ctarget
 */
cmd(
  {
    pattern: "ctarget",
    alias: ["caddgroup"],
    react: "🎯",
    category: "config",
    filename: __filename,
  },
  async (bot, mek, m, { from, reply }) => {
    try {
      if (!isGroupJid(from)) return reply("Use this command inside a group.");

      const store = readStore();
      if (!store.groups.includes(from)) {
        store.groups.push(from);
        writeStore(store);
      }

      const name = await safeGroupName(bot, from);
      return reply(`Saved target group: *${name}*`);
    } catch (e) {
      console.log(e);
      reply("Error saving target group.");
    }
  }
);

/* ================= LIST / REMOVE / CLEAR (optional) ================= */

cmd(
  {
    pattern: "ctargetlist",
    alias: ["clistgroups"],
    react: "📋",
    category: "config",
    filename: __filename,
  },
  async (bot, mek, m, { reply }) => {
    const store = readStore();
    if (!store.groups.length) return reply("No target groups saved.");

    const names = await Promise.all(store.groups.map((g) => safeGroupName(bot, g)));
    const lines = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
    reply(`Saved target groups:\n\n${lines}`);
  }
);

cmd(
  {
    pattern: "ctargetclear",
    alias: ["ccleargroups"],
    react: "🗑️",
    category: "config",
    filename: __filename,
  },
  async (bot, mek, m, { reply }) => {
    writeStore({ groups: [] });
    reply("All target groups cleared.");
  }
);

cmd(
  {
    pattern: "ctargetdel",
    alias: ["cremovegroup"],
    react: "❌",
    category: "config",
    filename: __filename,
  },
  async (bot, mek, m, { q, reply }) => {
    const store = readStore();
    if (!store.groups.length) return reply("No target groups saved.");

    const n = parseInt((q || "").trim(), 10);
    if (!n || n < 1 || n > store.groups.length) {
      return reply("Usage: .ctargetdel <number>\nExample: .ctargetdel 2");
    }

    const removed = store.groups.splice(n - 1, 1)[0];
    writeStore(store);
    reply(`Removed target group: ${removed}`);
  }
);

/* ================= 2) .csong ================= */
/**
 * .csong <song name/link>
 * - If 1 group saved -> send directly
 * - If >1 groups saved -> show list, then user sends a number (or .csel <number>)
 */
cmd(
  {
    pattern: "csong",
    alias: ["cmusic", "cmp3"],
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      const store = readStore();
      const groups = store.groups || [];

      if (!groups.length) {
        return reply("No target groups set. Use .ctarget inside a group first.");
      }
      if (!q) return reply("Please provide a song name or YouTube link.");

      // Find the YouTube video once (don’t spam target groups)
      await reply("Searching...");
      const video = await getYoutube(q);
      if (!video) return reply("No results found.");

      // If only 1 group -> send directly
      if (groups.length === 1) {
        const gname = await safeGroupName(bot, groups[0]);
        await reply(`Sending to: ${gname}`);
        await sendSongToGroup(bot, mek, groups[0], video, reply);
        return reply("Done.");
      }

      // If multiple groups -> show list and wait for number
      const names = await Promise.all(groups.map((g) => safeGroupName(bot, g)));
      const listText = names.map((n, i) => `${i + 1}. ${n}`).join("\n");

      // Save pending selection for this user
      const userKey = mek?.sender || m?.sender || mek?.key?.participant || from;
      pending[userKey] = {
        chat: from,      // only accept selection from the same chat
        video,
        groups,
        createdAt: Date.now(),
      };

      return reply(
        `Select a target group by sending the number (1-${groups.length}).\n\n${listText}\n\nTip: You can also use .csel <number>\nExample: .csel 2`
      );
    } catch (e) {
      console.log(e);
      reply("Error while processing the song.");
    }
  }
);

/* ================= 3) Selection by number ================= */
/**
 * Preferred: user just sends "2"
 * If your cmd system supports regex patterns, this will work.
 * If not, user can use: .csel 2
 */
cmd(
  {
    pattern: "^(\\d+)$", // regex number-only
    react: "✅",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      const userKey = mek?.sender || m?.sender || mek?.key?.participant || from;
      const p = pending[userKey];
      if (!p) return; // no pending selection -> ignore
      if (p.chat !== from) return; // must be same chat

      const n = parseInt((q || "").trim(), 10);
      if (!n || n < 1 || n > p.groups.length) {
        return reply(`Invalid number. Send a number between 1 and ${p.groups.length}.`);
      }

      const target = p.groups[n - 1];
      const gname = await safeGroupName(bot, target);

      delete pending[userKey];

      await reply(`Sending to: ${gname}`);
      await sendSongToGroup(bot, mek, target, p.video, reply);
      return reply("Done.");
    } catch (e) {
      console.log(e);
      reply("Error while sending the song.");
    }
  }
);

/* ================= Backup selection command: .csel <number> ================= */

cmd(
  {
    pattern: "csel",
    alias: ["cselect"],
    react: "✅",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      const userKey = mek?.sender || m?.sender || mek?.key?.participant || from;
      const p = pending[userKey];
      if (!p) return reply("No pending selection. Use .csong <name/link> first.");
      if (p.chat !== from) return reply("Please select in the same chat where you started .csong.");

      const n = parseInt((q || "").trim(), 10);
      if (!n || n < 1 || n > p.groups.length) {
        return reply(`Usage: .csel <number>\nValid range: 1-${p.groups.length}`);
      }

      const target = p.groups[n - 1];
      const gname = await safeGroupName(bot, target);

      delete pending[userKey];

      await reply(`Sending to: ${gname}`);
      await sendSongToGroup(bot, mek, target, p.video, reply);
      return reply("Done.");
    } catch (e) {
      console.log(e);
      reply("Error while sending the song.");
    }
  }
);
