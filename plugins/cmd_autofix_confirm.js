// plugins/cmd_autofix_confirm.js
// ✅ Friendly command auto-fix with confirmation (1=run / 2=cancel)

const { commands } = require("../command");

const prefix = ".";
const ENABLED = true;
const THRESHOLD = 0.62;        // 0.55~0.70 best
const TIMEOUT_MS = 45000;      // 45 seconds

// pending confirm per chat
const pending = new Map(); // chatId -> { fixedBody, expiresAt, suggestName, wrongName }

function normCmd(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// simple prefix similarity (good for typos)
function similarity(a, b) {
  a = normCmd(a);
  b = normCmd(b);
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);

  let same = 0;
  for (let i = 0; i < minLen; i++) if (a[i] === b[i]) same++;
  return same / maxLen;
}

function bestMatch(input) {
  const inCmd = normCmd(input);
  if (!inCmd) return null;

  let best = null;
  let bestScore = 0;

  for (const c of commands || []) {
    const name = c?.pattern;
    if (!name) continue;

    const s1 = similarity(inCmd, name);
    if (s1 > bestScore) {
      bestScore = s1;
      best = name;
    }

    if (Array.isArray(c.alias)) {
      for (const al of c.alias) {
        const s2 = similarity(inCmd, al);
        if (s2 > bestScore) {
          bestScore = s2;
          best = name; // run main pattern
        }
      }
    }
  }

  if (best && bestScore >= THRESHOLD) return { name: best, score: bestScore };
  return null;
}

function isYes(text) {
  const t = String(text || "").trim().toLowerCase();
  return ["1", "yes", "y", "ok", "okay", "ow", "hari", "ha"].includes(t);
}

function isNo(text) {
  const t = String(text || "").trim().toLowerCase();
  return ["2", "no", "n", "epa", "na", "cancel"].includes(t);
}

// MAIN HOOK
// return values:
// { handled: true, newBody: null } -> stop processing message
// { handled: true, newBody: "...." } -> replace body and continue (run corrected cmd)
// { handled: false } -> do nothing
async function onMessage(conn, mek, m, ctx = {}) {
  if (!ENABLED) return { handled: false };

  const from = ctx.from || mek?.key?.remoteJid;
  const body = String(ctx.body || "").trim();
  const reply = ctx.reply;

  if (!from || !body || typeof reply !== "function") return { handled: false };

  // ✅ 1) if there is pending confirmation in this chat
  const p = pending.get(from);
  if (p) {
    if (Date.now() > p.expiresAt) {
      pending.delete(from);
      await reply("⏳ හරි dear, confirm time එක ඉවරයි. ආයෙ command එක type කරන්න 🙂");
      return { handled: true, newBody: null };
    }

    if (isYes(body)) {
      pending.delete(from);
      await reply(`✅ හරි! *${prefix}${p.suggestName}* run කරනවා… ⚡`);
      return { handled: true, newBody: p.fixedBody };
    }

    if (isNo(body)) {
      pending.delete(from);
      await reply("👌 Okayං dear. Command එක ආයෙ හරි විදිහට දාලා try කරන්න 🙂");
      return { handled: true, newBody: null };
    }

    // not yes/no -> keep pending, allow normal flow
    // (optional: you can block everything until confirm by returning handled:true)
    return { handled: false };
  }

  // ✅ 2) only handle commands
  if (!body.startsWith(prefix)) return { handled: false };

  const commandName = body.slice(prefix.length).trim().split(" ")[0].toLowerCase();
  const args = body.trim().split(/ +/).slice(1);
  const q = args.join(" ");

  // if command exists -> do nothing
  const exists = (commands || []).some(
    (c) => c.pattern === commandName || (Array.isArray(c.alias) && c.alias.includes(commandName))
  );
  if (exists) return { handled: false };

  // find best suggestion
  const best = bestMatch(commandName);
  if (!best?.name) {
    await reply(`😕 මේ command එක අඳුරගන්න බැරිවුනා: *${prefix}${commandName}*\nTry: *.menu*`);
    return { handled: true, newBody: null };
  }

  const fixedBody = `${prefix}${best.name}${q ? " " + q : ""}`;

  // save pending
  pending.set(from, {
    fixedBody,
    expiresAt: Date.now() + TIMEOUT_MS,
    suggestName: best.name,
    wrongName: commandName,
  });

  await reply(
    `😅ංhey dear, මේ command එක හරි නෑ වගේ: *${prefix}${commandName}*\n\n` +
      `ඔයා කියන්නෙ මේකද? 👉 *${prefix}${best.name}*\n\n` +
      `✅ Run කරන්න නම් *1* reply කරන්න\n` +
      `❌ Cancel කරන්න නම් *2* reply කරන්න\n\n` +
      `⏳ (45 seconds ඇතුළත)`
  );

  return { handled: true, newBody: null };
}

module.exports = { onMessage };
