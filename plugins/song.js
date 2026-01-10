const { cmd, commands } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (
    bot,
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
      if (!q) return reply("❌ *Please provide a song name or YouTube link*");

      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      let desc = `

🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}
👀 *Views:* ${data.views.toLocaleString()}
🔗 *Watch Here:* ${data.url}
`;

      // Send image with caption first
      await bot.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // 🔹 NOW ADD BUTTONS HERE 🔹
      const buttonMessage = {
        text: `🎵 *${data.title}*\n\nකරුණාකර ඔබට අවශ්‍ය ආකාරය තෝරන්න:`,
        footer: "MALIYA-MD Song Downloader",
        buttons: [
          { 
            buttonId: 'mp3btn', 
            buttonText: { displayText: '🎵 MP3 බාගත කරන්න' }, 
            type: 1 
          },
          { 
            buttonId: 'mp4btn', 
            buttonText: { displayText: '🎬 MP4 බාගත කරන්න' }, 
            type: 1 
          }
        ],
        headerType: 1
      };

      // Send button message
      await bot.sendMessage(from, buttonMessage, { quoted: mek });

      // Store song data for button handling (you might need a temporary storage)
      // This is a simple approach - you may need to use a database or cache
      global.songDataCache = global.songDataCache || {};
      global.songDataCache[sender] = {
        url: url,
        title: data.title,
        thumbnail: data.thumbnail,
        timestamp: data.timestamp
      };

    } catch (e) {
      console.log(e);
      reply(`❌ *Error:* ${e.message} 😞`);
    }
  }
);

// 🔹 ADD BUTTON HANDLER COMMAND 🔹
cmd(
  {
    pattern: "mp3",
    react: "⬇️",
    desc: "Download as MP3",
    category: "download",
    filename: __filename,
  },
  async (
    bot,
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
      // Check if user has searched for a song recently
      if (!global.songDataCache || !global.songDataCache[sender]) {
        return reply("❌ *කරුණාකර පළමුව සොං එකක් සොයන්න!*\nභාවිතය: !song <ගීතයේ නම>");
      }

      const songData = global.songDataCache[sender];
      
      await reply("⏳ *MP3 බාගත කරමින්... කරුණාකර රැඳී සිටින්න*");

      const quality = "192";
      const songDownload = await ytmp3(songData.url, quality);

      // Check duration
      let durationParts = songData.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏳ *සමාවන්න, මිනිත්තු 30ට වැඩි ගීත MP3 ආකාරයෙන් බාගත කිරීම සහාය නොදක්වයි.*");
      }

      // Send as audio
      await bot.sendMessage(
        from,
        {
          audio: { url: songDownload.download.url },
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );

      // Send as document
      await bot.sendMessage(
        from,
        {
          document: { url: songDownload.download.url },
          mimetype: "audio/mpeg",
          fileName: `${songData.title}.mp3`,
          caption: "🎶 *ඔබේ ගීතය සූදානම්!*",
        },
        { quoted: mek }
      );

      // Final message
      reply(
        "✅ *ගීතය සාර්ථකව බාගත කර ඇත!* 🎶\n\n" +
        "*🎧 ඔබේ සංගීතය භුක්ති විඳින්න!*\n" +
        "*👤 නිර්මාතෘ:* Malindu Nadith\n\n" +
        "🙏 *_MALIYA-MD_* භාවිතා කිරීමට ස්තුතියි"
      );

      // Clear cache for this user
      delete global.songDataCache[sender];

    } catch (e) {
      console.log(e);
      reply(`❌ *දෝෂය:* ${e.message} 😞`);
    }
  }
);

// 🔹 ADD MP4 BUTTON HANDLER 🔹
cmd(
  {
    pattern: "mp4",
    react: "⬇️",
    desc: "Download as MP4 Video",
    category: "download",
    filename: __filename,
  },
  async (
    bot,
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
      if (!global.songDataCache || !global.songDataCache[sender]) {
        return reply("❌ *කරුණාකර පළමුව සොං එකක් සොයන්න!*\nභාවිතය: !song <ගීතයේ නම>");
      }

      const songData = global.songDataCache[sender];
      
      await reply("⏳ *MP4 වීඩියෝව බාගත කරමින්...*");

      // Note: You'll need to add MP4 download functionality
      // For now, we'll show a message
      
      // If you have a ytmp4 function, use it like:
      // const videoDownload = await ytmp4(songData.url, "highest");
      
      // Temporary response
      reply(
        "🎬 *MP4 Download*\n\n" +
        `*වීඩියෝව:* ${songData.title}\n` +
        "*MP4 download feature එක දැනට සකස් කරමින්...*\n\n" +
        "කරුණාකර MP3 භාවිතා කරන්න හෝ නැවත උත්සාහ කරන්න."
      );

      // Clear cache
      delete global.songDataCache[sender];

    } catch (e) {
      console.log(e);
      reply(`❌ *දෝෂය:* ${e.message} 😞`);
    }
  }
);
