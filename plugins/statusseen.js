const { cmd } = require("../command");
const { proto } = require("@whiskeysockets/baileys");

let watcherActive = false;

cmd({
    pattern: "stseen",
    desc: "Activate / Deactivate auto WhatsApp status seen (v7)",
    category: "utility",
    react: "👀",
    filename: __filename,
}, async (conn, mek, m, { reply }) => {
    try {
        await reply(
            `*Status Seen Bot*\n\n` +
            `Reply with:\n` +
            `1️⃣ Activate auto status seen\n` +
            `2️⃣ Deactivate auto status seen`
        );

        // Listen for user's reply
        const listener = async ({ messages }) => {
            for (let message of messages) {
                if (!message.message || !message.key.fromMe) continue;

                const text = message.message.conversation?.trim();
                if (text === "1") {
                    watcherActive = true;
                    await reply("✅ Auto status seen ENABLED");
                } else if (text === "2") {
                    watcherActive = false;
                    await reply("❌ Auto status seen DISABLED");
                }
            }
        };

        conn.ev.on("messages.upsert", listener);

        // Watch WhatsApp stories/status updates
        conn.ev.on("stories.update", async (stories) => {
            if (!watcherActive) return;

            try {
                for (let story of stories) {
                    // Mark status as seen only
                    await conn.sendReadReceipt(story.key.remoteJid, story.key.participant, true);
                }
            } catch (err) {
                console.error("Status seen error:", err);
            }
        });

    } catch (err) {
        console.error("STSEEN PLUGIN ERROR:", err);
        reply("⚠️ Something went wrong in .stseen plugin");
    }
});
