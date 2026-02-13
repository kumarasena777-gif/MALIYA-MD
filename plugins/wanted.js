const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

cmd({
    pattern: "wanted",
    alias: ["wantedposter", "wantedlist"],
    react: "👮",
    desc: "Create wanted poster from image",
    category: "editor",
    filename: __filename,
},
async (bot, mek, m, { from, reply, quoted }) => {
    try {
        // Check if user replied to an image
        if (!quoted) {
            return reply("👮 *Please reply to an image*\n\nExample: Reply to any image with .wanted");
        }

        // Get the image from quoted message
        const media = await quoted.download();
        if (!media) {
            return reply("❌ Could not download the image");
        }

        reply("👮 *Creating wanted poster...*");

        // Save user image
        const inputPath = path.join(__dirname, `${Date.now()}_input.jpg`);
        fs.writeFileSync(inputPath, media);

        // Output path
        const outputPath = path.join(__dirname, `${Date.now()}_wanted.png`);

        // Create wanted poster
        try {
            // Load background and user image
            const [bg, userImg] = await Promise.all([
                Jimp.read("https://i.imgur.com/msO7m3Q.png"), // Wanted poster template
                Jimp.read(inputPath)
            ]);

            // Resize user image to fit wanted frame (240x240)
            userImg.resize(240, 240);
            
            // Position user image on wanted poster (x: 140, y: 170)
            bg.composite(userImg, 140, 170);
            
            // Save the poster
            await bg.writeAsync(outputPath);

            // Send the wanted poster
            await bot.sendMessage(from, {
                image: fs.readFileSync(outputPath),
                caption: `👮 *WANTED*\n\n🔫 Dead or Alive\n💰 Reward: $1,000,000\n\n> MALIYA-MD`
            }, { quoted: mek });

        } catch (editError) {
            console.log("Jimp error:", editError);
            
            // Alternative method if Jimp fails
            const wantedUrl = `https://api.popcat.xyz/wanted?image=${encodeURIComponent(await quoted.download())}`;
            
            await bot.sendMessage(from, {
                image: { url: wantedUrl },
                caption: `👮 *WANTED*\n\n🔫 Dead or Alive\n💰 Reward: $1,000,000\n\n> MALIYA-MD`
            }, { quoted: mek });
        }

        // Clean up files
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) {}

    } catch (e) {
        console.log("Wanted Error:", e);
        reply("❌ Error creating wanted poster. Please try again.");
    }
});

// Also add trigger command
cmd({
    pattern: "wanted",
    alias: ["wanted"],
    category: "editor",
},
async (bot, mek, m, { from, reply }) => {
    if (m.message?.imageMessage || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
        // Image is there, will be handled by main command
    } else {
        reply("👮 *Reply to an image with .wanted*");
    }
});
