const { cmd, commands } = require("../command");

const pendingMenu = {};
const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];

const headerImage =
  "https://raw.githubusercontent.com/Maliya-bro/MALIYA-MD/refs/heads/main/images/a1b18d21-fd72-43cb-936b-5b9712fb9af0.png";

cmd({
  pattern: "menu",
  react: "📜",
  desc: "Show command categories",
  category: "main",
  filename: __filename
}, async (test, m, msg, { from, sender, reply }) => {
  await test.sendMessage(from, { react: { text: "📜", key: m.key } });

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
  menuText += `Reply like: *.1* or *.2* to view commands.\n`;

  await test.sendMessage(from, {
    image: { url: headerImage },
    caption: menuText,
  }, { quoted: m });

  const key = (sender || "").split(":")[0];
  pendingMenu[key] = { step: "category", commandMap, categories };
});


/**
 * ✅ FIX: Make number selection a command (prefix required)
 * Users must reply: .1  .2  .10
 */
cmd({
  pattern: "([0-9]+)",          // catches .1, .2, .10 etc (because it's a command)
  dontAddCommandList: true,
  filename: __filename
}, async (test, m, msg, { from, body, sender, reply }) => {

  const key = (sender || "").split(":")[0];
  if (!pendingMenu[key] || pendingMenu[key].step !== "category") return;

  await test.sendMessage(from, { react: { text: "✅", key: m.key } });

  const { commandMap, categories } = pendingMenu[key];

  // body contains the whole message text; for commands it may include prefix.
  // We'll extract first number from body.
  const match = (body || "").match(/\d+/);
  if (!match) return reply("❌ Invalid selection.");

  const index = parseInt(match[0], 10) - 1;
  if (isNaN(index) || index < 0 || index >= categories.length) {
    return reply("❌ Invalid selection.");
  }

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
  }, { quoted: m });

  delete pendingMenu[key];
});
