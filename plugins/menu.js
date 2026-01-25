const { cmd, commands } = require("../command");

const pendingMenu = {};
const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];

const headerImage =
  "https://raw.githubusercontent.com/Maliya-bro/MALIYA-MD/refs/heads/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png";

function normalizeSender(s = "") {
  return (s || "").split(":")[0]; // remove device part
}

cmd({
  pattern: "menu",
  react: "📜",
  desc: "Show command categories",
  category: "main",
  filename: __filename
}, async (test, mek, m, { from, sender, reply }) => {

  await test.sendMessage(from, { react: { text: "📜", key: mek.key } });

  const commandMap = {};
  for (const command of commands) {
    if (command.dontAddCommandList) continue;
    const category = (command.category || "MISC").toUpperCase();
    if (!commandMap[category]) commandMap[category] = [];
    commandMap[category].push(command);
  }

  const categories = Object.keys(commandMap);

  let menuText = `*MAIN MENU FOR MALIYA-MD*\n`;
  menuText += `───────────────────────\n`;

  categories.forEach((cat, i) => {
    const emojiIndex = (i + 1).toString().split("").map(n => numberEmojis[n]).join("");
    menuText += `┃ ${emojiIndex} *${cat}* (${commandMap[cat].length})\n`;
  });

  menuText += `───────────────────────\n`;
  menuText += `*Reply with a number (1-${categories.length})*`;

  await test.sendMessage(from, {
    image: { url: headerImage },
    caption: menuText,
  }, { quoted: mek });

  // ✅ IMPORTANT: store with normalized sender
  const key = normalizeSender(sender);
  pendingMenu[key] = { step: "category", commandMap, categories, timestamp: Date.now() };
});

cmd({
  // ✅ SAME STYLE AS YOUR FILM PLUGIN
  filter: (text, { sender }) => {
    const key = (sender || "").split(":")[0];
    const t = (text || "").trim();

    if (!pendingMenu[key] || pendingMenu[key].step !== "category") return false;
    if (isNaN(t)) return false;

    const n = parseInt(t, 10);
    return n > 0 && n <= pendingMenu[key].categories.length;
  },
  dontAddCommandList: true,
  filename: __filename
}, async (test, mek, m, { body, sender, reply, from }) => {

  await test.sendMessage(from, { react: { text: "✅", key: mek.key } });

  const key = normalizeSender(sender);
  const { commandMap, categories } = pendingMenu[key];

  const index = parseInt((body || "").trim(), 10) - 1;
  const selectedCategory = categories[index];
  const cmdsInCategory = commandMap[selectedCategory];

  let cmdText = `*${selectedCategory} COMMANDS*\n`;
  cmdText += `───────────────────────\n`;

  cmdsInCategory.forEach(c => {
    const patterns = [c.pattern, ...(c.alias || [])]
      .filter(Boolean)
      .map(p => `.${p}`);
    cmdText += `${patterns.join(", ")} - ${c.desc || "No description"}\n`;
  });

  cmdText += `───────────────────────\n`;
  cmdText += `Total Commands: ${cmdsInCategory.length}\n`;

  await test.sendMessage(from, {
    image: { url: headerImage },
    caption: cmdText,
  }, { quoted: mek });

  delete pendingMenu[key];
});

// auto cleanup
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000;
  for (const s in pendingMenu) {
    if (now - pendingMenu[s].timestamp > timeout) delete pendingMenu[s];
  }
}, 5 * 60 * 1000);

module.exports = { pendingMenu };
