const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  AnyMessageContent,
  prepareWAMessageMedia,
  areJidsSameUser,
  downloadContentFromMessage,
  MessageRetryMap,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  generateMessageID, makeInMemoryStore,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const path = require('path');
const qrcode = require('qrcode-terminal');

const config = require('./config');
const { sms, downloadMediaMessage } = require('./lib/msg');
const {
  getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson
} = require('./lib/functions');
const { File } = require('megajs');
const { commands, replyHandlers } = require('./command');

const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = ['94701369636'];
const credsPath = path.join(__dirname, '/auth_info_baileys/creds.json');

async function ensureSessionFile() {
  if (!fs.existsSync(credsPath)) {
    if (!config.SESSION_ID) {
      console.error('❌ SESSION_ID missing!');
      process.exit(1);
    }

    console.log("🔄 Downloading WhatsApp session from MEGA...");

    const sessdata = config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);

    filer.download((err, data) => {
      if (err) {
        console.error("❌ Failed to download session:", err);
        process.exit(1);
      }

      fs.mkdirSync(path.join(__dirname, '/auth_info_baileys/'), { recursive: true });
      fs.writeFileSync(credsPath, data);

      console.log("✅ Session restored! Restarting...");
      setTimeout(connectToWA, 1500);
    });
  } else {
    setTimeout(connectToWA, 800);
  }
}

const antiDeletePlugin = require('./plugins/antidelete.js');
global.pluginHooks = global.pluginHooks || [];
global.pluginHooks.push(antiDeletePlugin);

async function connectToWA() {
  console.log("🔌 Connecting MALIYA-MD ...");
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '/auth_info_baileys/'));
  const { version } = await fetchLatestBaileysVersion();

  const bot = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    auth: state,
    version,
  });

  // ✅ Anti-delete hook (messages.update) - හරි තැන
  bot.ev.on('messages.update', async (updates) => {
    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onDelete) {
          try {
            await plugin.onDelete(bot, updates);
          } catch (e) {
            console.log("onDelete error:", e);
          }
        }
      }
    }
  });

  bot.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectToWA();
      }
    } else if (connection === "open") {
      console.log("✅ MALIYA-MD connected!");

      await bot.sendMessage(
        ownerNumber[0] + "@s.whatsapp.net",
        {
          image: {
            url: "https://github.com/Maliya-bro/MALIYA-MD/blob/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png?raw=true"
          },
          caption: "MALIYA-MD connected successfully ⚡! | Prefix '.' use *.menu* or *.list* to learn how to use MALIYA-MD"
        }
      );

      console.log("🔄 Loading plugins...");
      fs.readdirSync("./plugins/")
        .filter(file => file.endsWith(".js"))
        .forEach(file => {
          try {
            require(`./plugins/${file}`);
            console.log("✔️ Plugin Loaded:", file);
          } catch (err) {
            console.log("❌ Plugin Error:", file, err);
          }
        });
      console.log("✅ All plugins loaded!");
    }
  });

  bot.ev.on("creds.update", saveCreds);

  bot.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages[0];
    if (!mek?.message) return;

    mek.message =
      getContentType(mek.message) === "ephemeralMessage"
        ? mek.message.ephemeralMessage.message
        : mek.message;

    // ✅ STATUS HANDLER (conn -> bot)
    if (mek.key?.remoteJid === 'status@broadcast') {
      const senderJid = mek.key.participant || mek.key.remoteJid || "unknown@s.whatsapp.net";
      const mentionJid = senderJid.includes("@s.whatsapp.net") ? senderJid : senderJid + "@s.whatsapp.net";

      if (config.AUTO_STATUS_SEEN === "true") {
        try {
          await bot.readMessages([mek.key]);
          console.log(`[✓] Status seen: ${mek.key.id}`);
        } catch (e) {
          console.error("❌ Failed to mark status as seen:", e);
        }
      }

      if (config.AUTO_STATUS_REACT === "true" && mek.key.participant) {
        try {
          const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '💜', '💙', '🌝', '😎', '💚', '🥲'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

          await bot.sendMessage(mek.key.participant, {
            react: {
              text: randomEmoji,
              key: mek.key,
            }
          });

          console.log(`[✓] Reacted to status of ${mek.key.participant} with ${randomEmoji}`);
        } catch (e) {
          console.error("❌ Failed to react to status:", e);
        }
      }

      if (mek.message?.extendedTextMessage && !mek.message.imageMessage && !mek.message.videoMessage) {
        const text = mek.message.extendedTextMessage.text || "";
        if (text.trim().length > 0) {
          try {
            await bot.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
              text: `📝 *Text Status*\n👤 From: @${mentionJid.split("@")[0]}\n\n${text}`,
              mentions: [mentionJid]
            });
            console.log(`✅ Text-only status from ${mentionJid} forwarded.`);
          } catch (e) {
            console.error("❌ Failed to forward text status:", e);
          }
        }
      }

      if (mek.message?.imageMessage || mek.message?.videoMessage) {
        try {
          const msgType = mek.message.imageMessage ? "imageMessage" : "videoMessage";
          const mediaMsg = mek.message[msgType];

          const stream = await downloadContentFromMessage(
            mediaMsg,
            msgType === "imageMessage" ? "image" : "video"
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          const mimetype = mediaMsg.mimetype || (msgType === "imageMessage" ? "image/jpeg" : "video/mp4");
          const captionText = mediaMsg.caption || "";

          await bot.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
            [msgType === "imageMessage" ? "image" : "video"]: buffer,
            mimetype,
            caption: `📥 *Forwarded Status*\n👤 From: @${mentionJid.split("@")[0]}\n\n${captionText}`,
            mentions: [mentionJid]
          });

          console.log(`✅ Media status from ${mentionJid} forwarded.`);
        } catch (err) {
          console.error("❌ Failed to download or forward media status:", err);
        }
      }

      return; // ✅ status messages වලට command handler run නොවෙන්න
    }

    // ----------- NORMAL MESSAGE HANDLER -----------
    const m = sms(bot, mek);
    const from = mek.key.remoteJid;
    const type = getContentType(mek.message);

    const body =
      type === "conversation"
        ? mek.message.conversation
        : mek.message[type]?.text || mek.message[type]?.caption || "";

    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : "";
    const args = body.split(" ").slice(1);
    const q = args.join(" ");

    const sender = mek.key.fromMe ? bot.user.id : mek.key.participant || mek.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const isGroup = from.endsWith("@g.us");

    const botNumber = bot.user.id.split(":")[0];
    const pushname = mek.pushName || "User";

    const isOwner = ownerNumber.includes(senderNumber);

    const reply = (txt) => bot.sendMessage(from, { text: txt }, { quoted: mek });

    // Command Handler
    if (isCmd) {
      const cmd = commands.find(
        (c) =>
          c.pattern === commandName ||
          (c.alias && c.alias.includes(commandName))
      );

      if (cmd) {
        try {
          if (cmd.react) {
            bot.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
          }

          cmd.function(bot, mek, m, {
            from,
            quoted: mek,
            body,
            command: commandName,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            isOwner,
            reply,
          });
        } catch (e) {
          console.log("❌ Plugin Error:", e);
        }
      }
    }

    // Reply Handlers
    for (const handler of replyHandlers) {
      try {
        if (handler.filter(body, { sender, message: mek })) {
          await handler.function(bot, mek, m, {
            from,
            body,
            sender,
            reply,
          });
          break;
        }
      } catch (err) {
        console.log("Reply handler error:", err);
      }
    }
  });
}

ensureSessionFile();

app.get("/", (req, res) => res.send("MALIYA-MD Started ⚡"));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
