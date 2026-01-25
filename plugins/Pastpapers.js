const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");

// ================= CONFIG =================
const MAX_RESULTS = 10;
const MAX_MB = 20;

// Allowed / public sites (pastpapers.wiki included)
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

async function httpGet(url, opts = {}) {
  return axios.get(url, {
    timeout: 25000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9",
      ...(opts.headers || {})
    },
    ...opts
  });
}

// DuckDuckGo lite search (NO API key)
// NOTE: We now accept BOTH pdf links and normal page links (then we extract pdf later)
async function searchDDG(query) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await httpGet(url);

  const $ = cheerio.load(res.data);
  const results = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (!href || !title) return;

    const url2 = cleanUrl(href);
    if (!url2) return;

    const domain = domainOf(url2);
    if (!isAllowed(domain)) return;

    // Accept PDFs OR pages (we will extract pdf from pages)
    results.push({ title, url: url2, domain });
  });

  // Deduplicate by URL
  const seen = new Set();
  const uniq = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    uniq.push(r);
  }

  return uniq.slice(0, 25); // fetch more, later we pick best 10 with PDFs
}

// Extract first PDF link from an HTML page
async function extractPdfFromPage(pageUrl) {
  try {
    const res = await httpGet(pageUrl);
    const $ = cheerio.load(res.data);

    // Look for anchors with .pdf
    let pdf = null;

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = cleanUrl(new URL(href, pageUrl).toString());
      if (abs && isPdf(abs)) {
        pdf = abs;
        return false; // break
      }
    });

    // Sometimes PDF is inside iframes / embed
    if (!pdf) {
      const iframeSrc = $("iframe").attr("src") || $("embed").attr("src");
      if (iframeSrc) {
        const abs = cleanUrl(new URL(iframeSrc, pageUrl).toString());
        if (abs && isPdf(abs)) pdf = abs;
      }
    }

    return pdf;
  } catch {
    return null;
  }
}

async function resolveToPdf(result) {
  // If the result is already a PDF link, use it
  if (isPdf(result.url)) return result.url;

  // Otherwise try extracting from the page
  const pdf = await extractPdfFromPage(result.url);
  return pdf;
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

      await reply("Searching past papers...");

      // IMPORTANT: don't force "pdf" only — pages can contain PDFs
      const query =
        `${q} ` +
        "site:pastpapers.wiki OR site:moe.gov.lk OR site:e-thaksalawa.moe.gov.lk OR site:doenets.lk OR site:nie.lk OR site:schoolnet.lk";

      const raw = await searchDDG(query);

      // Resolve each result to a PDF link
      const resolved = [];
      for (const r of raw) {
        const pdfUrl = await resolveToPdf(r);
        if (pdfUrl) {
          resolved.push({ title: r.title, url: pdfUrl, domain: r.domain });
        }
        if (resolved.length >= MAX_RESULTS) break;
      }

      if (!resolved.length) {
        return reply(
          "No past paper PDFs found.\nTips:\n- Try correct spelling: science (not sciense)\n- Add keywords: 'term test', 'paper', 'pdf', 'grade 10', 'sinhala'\n- Example: .pp grade 10 science term test sinhala"
        );
      }

      // Store results for number reply
      global.replyStore = global.replyStore || {};
      global.replyStore[from] = { type: "pastpaper", data: resolved };

      let msg = "📄 Past Papers (reply with number)\n\n";
      resolved.forEach((r, i) => {
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
  { on: "text" },
  async (conn, mek, m, { from, body }) => {
    try {
      if (!global.replyStore || !global.replyStore[from]) return;
      const store = global.replyStore[from];
      if (store.type !== "pastpaper") return;

      const txt = String(body || "").trim();
      if (!/^\d+$/.test(txt)) return;

      const n = parseInt(txt, 10);
      if (n < 1 || n > store.data.length) return;

      const chosen = store.data[n - 1];
      await conn.sendMessage(from, { text: "Downloading paper..." }, { quoted: mek });

      const pdf = await downloadPdf(chosen.url);
      const name = (chosen.title || "past-paper")
        .replace(/[\\/:*?"<>|]/g, "")
        .slice(0, 80);

      await conn.sendMessage(
        from,
        { document: pdf, mimetype: "application/pdf", fileName: `${name}.pdf` },
        { quoted: mek }
      );

      delete global.replyStore[from];

    } catch (e) {
      console.error("PP DOWNLOAD ERROR:", e?.message || e);
      conn.sendMessage(from, { text: "Download failed. Try another number." }, { quoted: mek });
    }
  }
);
