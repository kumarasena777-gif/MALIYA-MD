const { cmd, replyHandlers } = require("../command");
const { ytmp3, tiktok } = require("sadaslk-dlcore");
const yts = require("yt-search");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const crypto = require("crypto");
const { sendInteractiveMessage } = require("gifted-btns");

const TEMP_DIR = path.join(__dirname, "../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const pendingSongType = Object.create(null);

/* ================= HELPERS ================= */

async function downloadFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const res = await axios({
    url,
    method: "GET",
    responseType: "stream",
    timeout: 180000,
    headers: { "User-Agent": "Mozilla/5.0" },
    maxRedirects: 5,
  });

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
      : query.split("/").pop().split("?")[0];

    return await yts({ videoId: id });
  }

  const search = await yts(query);
  return search.videos[0];
}

function generateProgressBar(duration = "0:00") {
  const totalBars = 10;
  const bar = "─".repeat(totalBars);
  return `*00:00* ${bar}○ *${duration}*`;
}

function makeTempFile(ext = ".mp3") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(TEMP_DIR, `${Date.now()}_${id}${ext}`);
}

function safeUnlink(file) {
  try {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

function formatViews(num) {
  if (!num) return "Unknown";
  return Number(num).toLocaleString();
}

function sanitizeFileName(name = "youtube_audio") {
  return String(name).replace(/[\\/:*?"<>|]/g, "").trim() || "youtube_audio";
}

function makePendingKey(sender, from) {
  return `${from || ""}::${(sender || "").split(":")[0]}`;
}

function normalizeText(s = "") {
  return String(s)
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function tryParseJsonString(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractTexts(body, mek, m) {
  const texts = [];

  const direct = [
    body,
    m?.body,
    m?.text,
    m?.message?.conversation,
    m?.message?.extendedTextMessage?.text,
    m?.message?.buttonsResponseMessage?.selectedButtonId,
    m?.message?.buttonsResponseMessage?.selectedDisplayText,
    m?.message?.templateButtonReplyMessage?.selectedId,
    m?.message?.templateButtonReplyMessage?.selectedDisplayText,
    m?.message?.listResponseMessage?.title,
    m?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    m?.message?.interactiveResponseMessage?.body?.text,
    m?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
    mek?.message?.conversation,
    mek?.message?.extendedTextMessage?.text,
    mek?.message?.buttonsResponseMessage?.selectedButtonId,
    mek?.message?.buttonsResponseMessage?.selectedDisplayText,
    mek?.message?.templateButtonReplyMessage?.selectedId,
    mek?.message?.templateButtonReplyMessage?.selectedDisplayText,
    mek?.message?.listResponseMessage?.title,
    mek?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    mek?.message?.interactiveResponseMessage?.body?.text,
    mek?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
  ];

  for (const item of direct) {
    if (item) texts.push(String(item).trim());
  }

  const p1 = m?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  const p2 = mek?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;

  for (const raw of [p1, p2]) {
    if (!raw) continue;
    const parsed = tryParseJsonString(raw);
    if (!parsed) continue;

    const vals = [
      parsed.id,
      parsed.selectedId,
      parsed.selectedRowId,
      parsed.title,
      parsed.display_text,
      parsed.text,
      parsed.name,
    ];

    for (const v of vals) {
      if (v) texts.push(String(v).trim());
    }
  }

  return [...new Set(texts.filter(Boolean))];
}

function extractSongTypeFromTexts(texts) {
  const normalized = texts.map((t) => normalizeText(t)).filter(Boolean);

  for (const text of normalized) {
    if (text.includes("SONGTYPE:AUDIO")) return "audio";
    if (text.includes("SONGTYPE:DOCUMENT")) return "document";
    if (text.includes("SONGTYPE:VOICE")) return "voice";

    if (text === "1") return "audio";
    if (text === "2") return "document";
    if (text === "3") return "voice";

    if (text.includes("AUDIO")) return "audio";
    if (text.includes("DOCUMENT")) return "document";
    if (text.includes("VOICE")) return "voice";
  }

  return null;
}

function buildSongDetails(video) {
  const duration = video.timestamp || "0:00";
  const progressBar = generateProgressBar(duration);

  return `🎵 *${video.title || "Unknown Title"}*

╭━━━〔 🎧 SONG DETAILS 〕━━━╮
👤 *Channel:* ${video.author?.name || "Unknown Channel"}
⏱️ *Duration:* ${duration}
👀 *Views:* ${formatViews(video.views)}
📅 *Uploaded:* ${video.ago || "Unknown"}
🔗 *Link:* ${video.url || "Unavailable"}
╰━━━━━━━━━━━━━━━╯

${progressBar}

🍀 *ENJOY YOUR SONG* 🍀
> USE HEADPHONES FOR THE BEST EXPERIENCE 🎧`;
}

function getSongTypeLabel(type) {
  switch (String(type).toLowerCase()) {
    case "audio":
      return "Audio";
    case "document":
      return "Document";
    case "voice":
      return "Voice Note";
    default:
      return "Unknown";
  }
}

async function sendSongInteractiveMenu(sock, from, mek, video) {
  return sendInteractiveMessage(
    sock,
    from,
    {
      image: { url: video.thumbnail },
      text: buildSongDetails(video),
      footer: "MALIYA-MD | Song Type Selector",
      interactiveButtons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "Select Song Type ↯",
            sections: [
              {
                title: "Audio Formats",
                rows: [
                  {
                    title: "🎵 Audio",
                    description: "Send as normal audio",
                    id: "songtype:audio",
                  },
                  {
                    title: "📄 Document",
                    description: "Send as mp3 file document",
                    id: "songtype:document",
                  },
                  {
                    title: "🎙 Voice Note",
                    description: "Send as PTT voice note",
                    id: "songtype:voice",
                  },
                ],
              },
            ],
          }),
        },
      ],
    },
    { quoted: mek }
  );
}

function isDuplicateAction(state, type) {
  const now = Date.now();
  const sig = `songtype:${type}`;

  if (state.lastActionSig === sig && now - (state.lastActionAt || 0) < 5000) {
    return true;
  }

  state.lastActionSig = sig;
  state.lastActionAt = now;
  return false;
}

async function handleSongTypeDownload(sock, mek, from, sender, reply, typeRaw) {
  const key = makePendingKey(sender, from);
  const pending = pendingSongType[key];
  if (!pending) return;

  const type = String(typeRaw || "").toLowerCase();
  if (!["audio", "document", "voice"].includes(type)) return;

  if (pending.isProcessing) return;
  if (isDuplicateAction(pending, type)) return;

  pending.isProcessing = true;

  let filePath = null;

  try {
    await reply(`⬇️ Downloading song as *${getSongTypeLabel(type)}*from MALIYA-MD...`);

    const data = await ytmp3(pending.video.url);
    if (!data?.url) {
      delete pendingSongType[key];
      return reply("❌ Failed to download song.");
    }

    filePath = makeTempFile(".mp3");
    await downloadFile(data.url, filePath);

    const cleanTitle = sanitizeFileName(pending.video.title);

    if (type === "audio") {
      await sock.sendMessage(
        from,
        {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
        },
        { quoted: mek }
      );
    } else if (type === "document") {
      await sock.sendMessage(
        from,
        {
          document: fs.readFileSync(filePath),
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
          caption: `🎵 *${pending.video.title || "Unknown Title"}*\n\n✅ Sent as document.`,
        },
        { quoted: mek }
      );
    } else if (type === "voice") {
      await sock.sendMessage(
        from,
        {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
        },
        { quoted: mek }
      );
    }

    delete pendingSongType[key];
  } catch (e) {
    console.log("SONG TYPE ERROR:", e);
    reply("❌ Error while downloading song.");
    delete pendingSongType[key];
  } finally {
    safeUnlink(filePath);

    if (pendingSongType[key]) {
      pendingSongType[key].isProcessing = false;
    }
  }
}

/* ================= SONG ================= */

cmd(
  {
    pattern: "song",
    alias: ["mp3", "music", "sound"],
    react: "🎵",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, sender, reply }) => {
    try {
      if (!q) return reply("🎧 Please send a song name or YouTube link.");

      await reply("🔍 Searching YouTube...");
      const video = await getYoutube(q);
      if (!video) return reply("❌ No results found.");

      const key = makePendingKey(sender, from);

      pendingSongType[key] = {
        video,
        from,
        createdAt: Date.now(),
        isProcessing: false,
        lastActionSig: "",
        lastActionAt: 0,
      };

      await sendSongInteractiveMenu(bot, from, mek, video);
    } catch (e) {
      console.log("SONG MENU ERROR:", e);
      reply("❌ Error while preparing song menu.");
    }
  }
);

replyHandlers.push({
  filter: (_body, { sender, from }) => {
    const key = makePendingKey(sender, from);
    return !!pendingSongType[key];
  },

  function: async (sock, mek, m, { from, body, sender, reply }) => {
    const key = makePendingKey(sender, from);
    const pending = pendingSongType[key];
    if (!pending) return;
    if (pending.isProcessing) return;

    const texts = extractTexts(body, mek, m);
    let type = extractSongTypeFromTexts(texts);

    if (!type && /^[1-3]$/.test(String(body || "").trim())) {
      const map = { 1: "audio", 2: "document", 3: "voice" };
      type = map[String(body).trim()];
    }

    if (!type) return;

    return handleSongTypeDownload(sock, mek, from, sender, reply, type);
  },
});

/* ================= TIKTOK ================= */

cmd(
  {
    pattern: "tiktok",
    alias: ["ttdl", "tt", "tiktokdl"],
    react: "🎥",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("Please send a TikTok link.");

      reply("Downloading TikTok video...");
      const data = await tiktok(q);

      if (!data?.no_watermark)
        return reply("Failed to download TikTok video.");

      await bot.sendMessage(
        from,
        {
          video: { url: data.no_watermark },
          caption: "TikTok video downloaded successfully.\nMALIYA-MD ❤️",
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log(e);
      reply("Error while downloading TikTok video.");
    }
  }
);

setInterval(() => {
  const now = Date.now();
  const timeout = 2 * 60 * 1000;

  for (const key of Object.keys(pendingSongType)) {
    if (now - pendingSongType[key].createdAt > timeout) {
      delete pendingSongType[key];
    }
  }
}, 30000);
