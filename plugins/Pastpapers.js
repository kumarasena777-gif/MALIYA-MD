const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");

// ================= CONFIG =================
const MAX_RESULTS = 10;
const MAX_MB = 20;

// Allowed / public Sri Lankan education sites + pastpapers.wiki
const ALLOWED_DOMAINS = [
  "moe.gov.lk",
  "e-thaksalawa.moe.gov.lk",
  "doenets.lk",
  "nie.lk",
  "schoolnet.lk",
  "pastpapers.wiki",
];

// =========================================
function cleanUrl(u) {
  try { return new URL(u).toString(); } catch { return null; }
}
function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function isAllowed(domain) {
  return ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}
function isPdf(u) {
  return /\.pdf(\?|#|$)/i.test(u);
}

// DuckDuckGo lite search (no API key)
async function searchDDG(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await axios.get(url, {
    timeout: 25000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const $ = cheerio.load(res.data);
  const results = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (!href || !title) return;

    const url2 = cleanUrl(href);
    if (!url2 || !isPdf(url2)) return;

    const domain = domainOf(url2);
    if (!isAllowed(domain)) return;

    results.push({ title, url: url2, domain });
  });

  // Deduplicate
  const seen = new Set();
  return results.filter(x => (seen.has(x.url) ? false : seen.add(x.url)))
                .slice(0, MAX_RESULTS);
}

async function downloadPdf(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5,
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const size = Number(res.headers["content-length"] || 0);
  if (size && size > MAX_MB * 1024 * 1024) throw new Error("File too large");

  const buf = Buffer.from(res.data);
  if (buf.length > MAX_MB * 1024 * 1024) throw new Error("File too large");
  return buf;
}

// ================= COMMAND: .pp =================
cmd(
  {
    pattern: "pp",
    desc: "Search Sri Lankan past papers and reply with a number to download",
    category: "Education",
    react: "📄",
    filename: __filename
  },
  async (conn, mek, m, { from, q, reply }) => {
    try {
      if (!q) {
        return reply(
          "Usage:\n.pp <paper name>\nExample:\n.pp grade 10 science 3rd term test sinhala"
        );
      }

      await reply("Searching past papers from MALIYA-MD...");

      const query =
        `${q} pdf ` +
        "site:moe.gov.lk OR site:e-thaksalawa.moe.gov.lk OR site:doenets.lk " +
        "OR site:nie.lk OR site:schoolnet.lk OR site:pastpapers.wiki";

      const results = await searchDDG(query);
      if (!results.length) {
        return reply("No past paper PDFs found. Try different keywords.");
      }

      // 🔑 Store results in EXISTING number-reply system
      global.replyStore = global.replyStore || {};
      global.replyStore[from] = {
        type: "pastpaper",
        data: results
      };

      let msg = "📄 Past Papers (reply with number)\n\n";
      results.forEach((r, i) => {
        msg += `${i + 1}. ${r.title}\n   (${r.domain})\n`;
      });
      msg += "\nReply with: 1 / 2 / 3 ...";

      return reply(msg);

    } catch (e) {
      console.error("PP SEARCH ERROR:", e?.message || e);
      reply("Search failed. Please try again later.");
    }
  }
);

// ========== NUMBER REPLY HANDLER (NO index.js CHANGE) ==========
cmd(
  {
    on: "text"
  },
  async (conn, mek, m, { from, body }) => {
    try {
      if (!global.replyStore || !global.replyStore[from]) return;
      const store = global.replyStore[from];
      if (store.type !== "pastpaper") return;

      if (!/^\d+$/.test(body)) return;
      const n = parseInt(body, 10);
      if (n < 1 || n > store.data.length) return;

      const chosen = store.data[n - 1];
      await conn.sendMessage(from, { text: "Downloading paper..." }, { quoted: mek });

      const pdf = await downloadPdf(chosen.url);
      const name = (chosen.title || "past-paper")
        .replace(/[\\/:*?"<>|]/g, "")
        .slice(0, 80);

      await conn.sendMessage(
        from,
        {
          document: pdf,
          mimetype: "application/pdf",
          fileName: `${name}.pdf`
        },
        { quoted: mek }
      );

      delete global.replyStore[from];

    } catch (e) {
      console.error("PP DOWNLOAD ERROR:", e?.message || e);
      conn.sendMessage(from, { text: "Download failed. Try another number." }, { quoted: mek });
    }
  }
);
