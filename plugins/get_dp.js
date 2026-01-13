const { cmd } = require("../command");

cmd(
  {
    pattern: "getpp",
    react: "🖼️",
    desc: "Get your WhatsApp DP (private chat only, returns to you)",
    category: "utility",
    filename: __filename,
  },
  async (conn, mek, m, { from, reply }) => {
    try {
      // Group block
      if (from.endsWith("@g.us")) {
        return reply("*❌ This command works only in private chat.*");
      }

      // DP owner = command sender
      const userJid = mek.sender;

      let pp;
      try {
        pp = await conn.profilePictureUrl(userJid, "image");
      } catch {
        return reply("*❌ You don't have a profile picture or it's private.*");
      }

      // Send DP back to the user who typed the command
      await conn.sendMessage(
        from,
        {
          image: { url: pp },
          caption: "🖼️ *Here is your WhatsApp profile picture*",
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error(e);
      reply("*❌ Error while fetching your DP*");
    }
  }
);
