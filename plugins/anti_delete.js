// Anti-Delete Plugin (Always ON)
// Compatible with Baileys MD bots (MALIYA-MD style)

export async function before(m, { conn }) {
  if (!m.message) return
  if (m.key.fromMe) return

  // message delete event
  if (m.message.protocolMessage?.type === 0) {
    let key = m.message.protocolMessage.key
    let chat = key.remoteJid

    // load deleted message
    let msg = conn.loadMessage(chat, key.id)
    if (!msg || !msg.message) return

    let sender = msg.key.participant || msg.key.remoteJid
    let name = await conn.getName(sender)

    let teks = `🛑 *ANTI DELETE*\n
👤 *Name:* ${name}
📱 *Number:* ${sender.split('@')[0]}
📍 *Chat:* ${chat.includes('@g.us') ? 'Group' : 'Private'}
🕒 *Deleted Message Restored*`

    // text message
    if (msg.message.conversation) {
      await conn.sendMessage(chat, {
        text: teks + `\n\n💬 *Message:*\n${msg.message.conversation}`
      })
    }

    // image
    else if (msg.message.imageMessage) {
      await conn.sendMessage(chat, {
        image: await conn.downloadMediaMessage(msg),
        caption: teks + `\n\n🖼️ *Deleted Image*`
      })
    }

    // video
    else if (msg.message.videoMessage) {
      await conn.sendMessage(chat, {
        video: await conn.downloadMediaMessage(msg),
        caption: teks + `\n\n🎥 *Deleted Video*`
      })
    }

    // other types
    else {
      await conn.sendMessage(chat, {
        text: teks + `\n\n⚠️ *Deleted message type not supported*`
      })
    }
  }
                                          }
