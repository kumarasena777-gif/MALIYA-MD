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

function detectMedia(m) {
  if (!m) return null;

  if (m.imageMessage) {
    const mime = m.imageMessage.mimetype || "";
    const ext = mime.includes("png") ? ".png" : ".jpg";
    return { type: "image", node: m.imageMessage, ext };
  }

  if (m.videoMessage) {
    return { type: "video", node: m.videoMessage, ext: ".mp4" };
  }

  if (m.audioMessage) {
    const isPtt = m.audioMessage.ptt === true;
    return {
      type: "audio",
      node: m.audioMessage,
      ext: isPtt ? ".ogg" : ".mp3",
      ptt: isPtt,
    };
  }

  return null;
}

cmd(
  {
    pattern: "vv",
    desc: "Convert View Once media to normal (reply to it)",
    category: "tools",
    react: "👁️",
    filename: __filename,
  },
  async (conn, mek, m, { from, isGroup, reply }) => {
    try {
      // ===== get quoted message (raw Baileys way) =====
      const ctx =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo ||
        mek.message?.documentMessage?.contextInfo ||
        mek.message?.audioMessage?.contextInfo ||
        null;

      const quotedMessage = ctx?.quotedMessage;
      const stanzaId = ctx?.stanzaId;
      const participant = ctx?.participant;

      if (!quotedMessage || !stanzaId) {
        return reply("❌ *View Once msg ekata reply karala `.vv` danna.*");
      }

      // ===== check view once =====
      const isVO =
        !!quotedMessage?.viewOnceMessage ||
        !!quotedMessage?.viewOnceMessageV2 ||
        !!quotedMessage?.ephemeralMessage?.message?.viewOnceMessage ||
        !!quotedMessage?.ephemeralMessage?.message?.viewOnceMessageV2;

      if (!isVO) {
        return reply("❌ *Oya reply kare View Once msg ekakata nemei.*");
      }

      // ===== unwrap =====
      const clean = unwrapMessage(quotedMessage);
      const media = detectMedia(clean);

      if (!media) {
        return reply("❌ *Image / Video / Audio / Voice witharai support.*");
      }

      if (!media.node?.mediaKey) {
        return reply("❌ *Me View Once media eka download karanna ba.*");
      }

      // ===== build quoted key =====
      const quotedKey = {
        remoteJid: from,
        fromMe: false,
        id: stanzaId,
      };
      if (isGroup && participant) quotedKey.participant = participant;

      // ===== download =====
      const buffer = await downloadMediaMessage(
        { key: quotedKey, message: clean },
        "buffer",
        {}
      );

      if (!buffer || !buffer.length) {
        return reply("❌ *Download fail una.*");
      }

      const filePath = path.join(
        tempFolder,
        `vv_${stanzaId}_${Date.now()}${media.ext}`
      );

      await fs.promises.writeFile(filePath, buffer);

      // ===== send =====
      if (media.type === "image") {
        await conn.sendMessage(
          from,
          { image: { url: filePath }, caption: media.node.caption || undefined },
          { quoted: mek }
        );
      }

      if (media.type === "video") {
        await conn.sendMessage(
          from,
          { video: { url: filePath }, caption: media.node.caption || undefined },
          { quoted: mek }
        );
      }

      if (media.type === "audio") {
        await conn.sendMessage(
          from,
          {
            audio: { url: filePath },
            mimetype: media.ptt
              ? "audio/ogg; codecs=opus"
              : media.node.mimetype || "audio/mpeg",
            ptt: media.ptt === true,
          },
          { quoted: mek }
        );
      }

      // cleanup
      setTimeout(() => {
        try { fs.unlinkSync(filePath); } catch {}
      }, 60 * 1000);

    } catch (e) {
      console.log("❌ .vv error:", e?.message || e);
      reply("❌ *View Once convert error.*");
    }
  }
);
