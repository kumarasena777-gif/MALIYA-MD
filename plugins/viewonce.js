const { cmd } = require('../command');
const ViewOnceHandler = require('../lib/viewOnceHandler');
const fs = require('fs');

// Initialize handler
const viewOnceHandler = new ViewOnceHandler();

cmd({
    pattern: "vv",
    desc: "View once message unlock",
    react: "🔓",
    category: "media",
    filename: __filename
},
async (bot, mek, m, {
    from, quoted, body, isCmd, command, args, q, isGroup,
    sender, senderNumber, botNumber2, botNumber, pushname,
    isMe, isOwner, groupMetadata, groupName, participants,
    groupAdmins, isBotAdmins, isAdmins, reply
}) => {
    try {
        // Check if it's a reply
        if (!quoted) {
            return reply("❌ Please send *.vv*!");
        }

        // Send processing message
        await reply("⏳ View once messagae processing...");

        // Extract the view once media
        const result = await viewOnceHandler.extractViewOnceMedia(bot, quoted);

        if (!result.success) {
            return reply(`❌ Error: ${result.error}\n\nThis is not a view once msg!`);
        }

        // Send the extracted media back
        const fileBuffer = fs.readFileSync(result.filePath);
        
        switch (result.mediaType) {
            case 'image':
                await bot.sendMessage(from, {
                    image: fileBuffer,
                    caption: `📸 View Once Image\n✅view onec msg has been unlocked bn MALIYA-MD!${result.caption ? '\n' + result.caption : ''}`,
                    mimetype: result.mimetype
                }, { quoted: mek });
                break;
                
            case 'video':
                await bot.sendMessage(from, {
                    video: fileBuffer,
                    caption: `🎬 View Once Video\n✅ view onec msg has been unlocked bn MALIYA-MD!${result.caption ? '\n' + result.caption : ''}`,
                    mimetype: result.mimetype
                }, { quoted: mek });
                break;
                
            case 'audio':
                await bot.sendMessage(from, {
                    audio: fileBuffer,
                    mimetype: result.mimetype,
                    ptt: result.mimetype.includes('ogg')
                }, { quoted: mek });
                break;
                
            case 'sticker':
                await bot.sendMessage(from, {
                    sticker: fileBuffer,
                    mimetype: result.mimetype
                }, { quoted: mek });
                break;
                
            case 'document':
                await bot.sendMessage(from, {
                    document: fileBuffer,
                    fileName: `viewonce_${Date.now()}.${result.filePath.split('.').pop()}`,
                    caption: `📄 View Once Document\n✅ view onec msg has been unlocked bn MALIYA-MD!!`,
                    mimetype: result.mimetype
                }, { quoted: mek });
                break;
                
            default:
                await reply(`view onec msg has been unlocked bn MALIYA-MD!\nType: ${result.mediaType}\nFile saved temporarily.`);
        }

        // Send success message
        await bot.sendMessage(from, {
            text: `✅ view onec msg has been unlocked bn MALIYA-MD!\n📁 Type: ${result.mediaType.toUpperCase()}`
        }, { quoted: mek });

        // Cleanup old files
        viewOnceHandler.cleanupTempFiles();

    } catch (error) {
        console.error('Error in .vv command:', error);
        reply(`❌ Error: ${error.message}`);
    }
});

// Also add auto-save version if needed
cmd({
    pattern: "autovv",
    desc: "Auto-save view once messages (ON/OFF)",
    react: "⚡",
    category: "media",
    filename: __filename
},
async (bot, mek, m, {
    from, quoted, body, isCmd, command, args, q, isGroup,
    sender, senderNumber, botNumber2, botNumber, pushname,
    isMe, isOwner, groupMetadata, groupName, participants,
    groupAdmins, isBotAdmins, isAdmins, reply
}) => {
    try {
        // This would require storing state in a database
        // For now, just show info
        reply(`🔧 Auto View Once feature\n\nCurrently only .vv reply method is available.\n\nUse: *.vv* as a reply to any view once message to view it unlimited times!`);
    } catch (error) {
        console.error(error);
        reply(`${error}`);
    }
});
