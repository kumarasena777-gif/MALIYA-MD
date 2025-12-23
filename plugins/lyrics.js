const { cmd } = require("../command");
const axios = require("axios");

cmd(
  {
    pattern: "lyr",
    react: "🎶",
    desc: "Get lyrics for a song (artist - title)",
    category: "music",
    filename: __filename,
  },
  async (
    danuwa,
    mek,
    m,
    {
      from,
      quoted,
      body,
      isCmd,
      command,
      args,
      q,
      isGroup,
      sender,
      senderNumber,
      botNumber2,
      botNumber,
      pushname,
      isMe,
      isOwner,
      groupMetadata,
      groupName,
      participants,
      groupAdmins,
      isBotAdmins,
      isAdmins,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("❌ Please provide artist and song: artist - song");

      // Split input
      let input = q.split("-");
      if (input.length < 2) return reply("⚠️ Format: artist - song");

      let artist = input[0].trim();
      let title = input[1].trim();

      // Call lyrics.ovh API
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const { data } = await axios.get(url);

      if (!data || !data.lyrics) return reply("❌ Lyrics not found!");

      const lyrics = data.lyrics;

      // Split long lyrics into chunks (WhatsApp limit safe)
      const chunkSize = 3000;
      for (let i = 0; i < lyrics.length; i += chunkSize) {
        await reply(lyrics.slice(i, i + chunkSize));
      }

    } catch (err) {
      console.error("LYRICS ERROR:", err.message);
      reply("⚠️ Could not fetch lyrics right now");
    }
  }
);
