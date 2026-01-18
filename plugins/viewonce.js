const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const tempFolder = path.join(__dirname, "../temp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

function unwrapMessage(message) {
  if (!message) return null;

  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message);

  return message;
}

function detectMediaType(m) {
  if (!m) return null;
  if (m.imageMessage) return { type: "image", node: m.imageMessage, ext: ".jpg" };
  if (m.videoMessage) return { type: "video", node: m.videoMessage, ext: ".mp4" };
  return null;
}

cmd(
  {
    pattern: "vv",
    desc: "Convert View Once image/video to normal (reply to view once message)",
    category: "tools",
    react: "👁️",
    filename: __filename,
  },
  async (conn, mek, m, { from, quoted, reply }) => {
    try {
      // Must reply to a message
      const q = m.quoted || quoted;
      if (!q || !q.message) {
        return reply("❌ *Reply (quote) to a View Once photo/video and type* `.vv`");
      }

      // Raw quoted message (Baileys form)
      const rawQuotedMsg = q.message;

      // Check if the quoted message is view-once wrapper
      const isVO =
        !!rawQuotedMsg?.viewOnceMessage ||
        !!rawQuotedMsg?.viewOnceMessageV2 ||
        !!rawQuotedMsg?.ephemeralMessage?.message?.viewOnceMessage ||
        !!rawQuotedMsg?.ephemeralMessage?.message?.viewOnceMessageV2;

      if (!isVO) {
        return reply("❌ *That message is not a View Once photo/video.*");
      }

      // Unwrap to inner imageMessage/videoMessage
      const clean = unwrapMessage(rawQuotedMsg);
      const inner = detectMediaType(clean);

      if (!inner) {
        return reply("❌ *Only View Once IMAGE/VIDEO supported.*");
      }

      // Build a downloadable message object
      // Use quoted key if available
      const dlKey = q.key || mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key;

      // Most wrappers provide q.key from sms() quoted
      const keyToUse = q.key || mek.key;

      const dlMsg = {
        key: keyToUse,
        message: clean,
      };

      // Guard for empty mediaKey (prevents "Cannot derive from empty media key")
      if (!inner.node?.mediaKey) {
        return reply("❌ *Cannot download this View Once media (missing mediaKey).*");
      }

      const buffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!buffer || !buffer.length) {
        return reply("❌ *Download failed (no data).*");
      }

      const filePath = path.join(
        tempFolder,
        `vv_${keyToUse.id || Date.now()}_${Date.now()}${inner.ext}`
      );

      await fs.promises.writeFile(filePath, buffer);

      // Keep original caption if any
      const originalCaption = inner.node?.caption || "";
      const cap = originalCaption || undefined;

      if (inner.type === "image") {
        await conn.sendMessage(from, { image: { url: filePath }, caption: cap }, { quoted: mek });
      } else {
        await conn.sendMessage(from, { video: { url: filePath }, caption: cap }, { quoted: mek });
      }

      // cleanup
      setTimeout(() => {
        try { fs.unlinkSync(filePath); } catch {}
      }, 60 * 1000);

    } catch (e) {
      console.log("❌ .vv error:", e?.message || e);
      reply("❌ *Error while converting View Once media.*");
    }
  }
);
