const { cmd } = require("../command");
const puppeteer = require("puppeteer");
const axios = require("axios");

const pendingSearch = {};
const pendingQuality = {};

// -----------------------------
// Quality Normalize
// -----------------------------
function normalizeQuality(text) {
  if (!text) return "Unknown";
  text = text.toUpperCase();
  if (/1080|FHD/.test(text)) return "1080p";
  if (/720|HD/.test(text)) return "720p";
  if (/480|SD/.test(text)) return "480p";
  if (/360/.test(text)) return "360p";
  return text;
}

// -----------------------------
// Search Movies from Cinesubz.lk
// -----------------------------
async function searchMovies(query) {
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] 
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const searchUrl = `https://cinesubz.lk/?s=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    
    // Wait for results
    await page.waitForSelector(".display-item .item-box", { timeout: 10000 }).catch(() => null);
    
    const results = await page.$$eval(".display-item .item-box", boxes =>
      boxes.slice(0, 10).map((box, index) => {
        const a = box.querySelector("a");
        const img = box.querySelector(".thumb img, img");
        const lang = box.querySelector(".language, .item-desc-giha .language")?.textContent || "Sinhala Sub";
        const quality = box.querySelector(".quality, .item-desc-giha .quality")?.textContent || "HD";
        const qty = box.querySelector(".qty, .item-desc-giha .qty")?.textContent || "MP4";
        
        return {
          id: index + 1,
          title: a?.title?.trim() || a?.textContent?.trim() || "",
          movieUrl: a?.href || "",
          thumb: img?.src || img?.getAttribute('data-src') || "",
          language: lang.trim(),
          quality: quality.trim(),
          qty: qty.trim(),
        };
      }).filter(m => m.title && m.movieUrl)
    );
    
    return results;
  } catch (error) {
    console.error("Search error:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// -----------------------------
// Get Movie Metadata
// -----------------------------
async function getMovieMetadata(url) {
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    
    const metadata = await page.evaluate(() => {
      const getText = (el) => el?.textContent?.trim() || "";
      
      // Title
      const title = getText(document.querySelector("h1, .details-title h3, .info-details .details-title h3, .post-title"));
      
      // Thumbnail
      let thumbnail = "";
      const thumbSelectors = [".splash-bg img", ".post-thumbnail img", "meta[property='og:image']"];
      for (const sel of thumbSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          thumbnail = el.src || el.content || "";
          if (thumbnail) break;
        }
      }
      
      // Language, Directors, Stars
      let language = "Sinhala Sub", directors = [], stars = [], duration = "", imdb = "", genres = [];
      
      // Get all paragraphs
      document.querySelectorAll("p, .info-col p, .info-col div").forEach(p => {
        const text = p.textContent || "";
        
        if (text.includes("Language:")) {
          language = text.replace("Language:", "").trim();
        }
        if (text.includes("Director:")) {
          directors = text.replace("Director:", "").split(",").map(d => d.trim());
        }
        if (text.includes("Stars:")) {
          stars = text.replace("Stars:", "").split(",").map(s => s.trim());
        }
        if (text.includes("Duration:")) {
          duration = text.replace("Duration:", "").trim();
        }
        if (text.includes("IMDb:")) {
          imdb = text.replace("IMDb:", "").trim();
        }
        if (text.includes("Genre:")) {
          genres = text.replace("Genre:", "").split(",").map(g => g.trim());
        }
      });
      
      return { title, language, duration, imdb, genres, directors, stars, thumbnail };
    });
    
    return metadata;
  } catch (error) {
    console.error("Metadata error:", error);
    return { 
      title: "", 
      language: "Sinhala Sub", 
      duration: "", 
      imdb: "", 
      genres: [], 
      directors: [], 
      stars: [], 
      thumbnail: "" 
    };
  } finally {
    await browser.close();
  }
}

// -----------------------------
// IMPORTANT: Get DIRECT DOWNLOAD Links from Cinesubz.lk
// -----------------------------
async function getDirectDownloadLinks(movieUrl) {
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] 
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(movieUrl, { waitUntil: "networkidle2", timeout: 60000 });
    
    // Wait for download links section
    await page.waitForSelector(".link-box, .download-links, .pixeldrain-link, table", { timeout: 10000 }).catch(() => null);
    
    // METHOD 1: Direct .mp4 .mkv links from cinesubz.lk
    const directLinks = await page.$$eval('a[href*=".mp4"], a[href*=".mkv"], a[href*=".avi"], a[href*="cinesubz.lk/download"]', links => {
      return links.map(link => {
        // Try to find quality and size from parent element
        let quality = "Unknown";
        let size = "Unknown";
        
        const parent = link.closest('tr, .link-box, .download-item, li, div');
        if (parent) {
          const qualityEl = parent.querySelector('.quality, td:nth-child(1), .link-quality, strong');
          const sizeEl = parent.querySelector('.size, td:nth-child(3) span, .link-size, small');
          
          if (qualityEl) quality = qualityEl.textContent.trim();
          if (sizeEl) size = sizeEl.textContent.trim();
        }
        
        return {
          link: link.href,
          quality: quality,
          size: size,
          type: 'direct'
        };
      });
    });
    
    // METHOD 2: Links that go to download pages
    const downloadPageLinks = await page.$$eval('.link-opt a, a[href*="cinesubz.lk/dl"], .download-btn', links => {
      return links.map(link => ({
        pageLink: link.href,
        quality: link.closest('tr, div')?.querySelector('.quality, td:nth-child(1)')?.textContent?.trim() || "Unknown",
        size: link.closest('tr, div')?.querySelector('.size, td:nth-child(3) span')?.textContent?.trim() || "Unknown"
      }));
    });
    
    let allLinks = [...directLinks];
    
    // METHOD 3: Check download pages for direct links
    if (downloadPageLinks.length > 0) {
      for (const item of downloadPageLinks) {
        try {
          const subPage = await browser.newPage();
          await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          await subPage.goto(item.pageLink, { waitUntil: "networkidle2", timeout: 30000 });
          
          // Wait for direct download link
          await new Promise(r => setTimeout(r, 5000));
          
          // Look for direct .mp4 .mkv links
          const direct = await subPage.$eval('a[href*=".mp4"], a[href*=".mkv"], a[href*="download"]', el => el.href).catch(() => null);
          
          if (direct) {
            allLinks.push({
              link: direct,
              quality: item.quality,
              size: item.size,
              type: 'direct'
            });
          }
          
          await subPage.close();
        } catch (e) {
          console.log("Subpage error:", e.message);
        }
      }
    }
    
    // Process and filter links
    const processedLinks = [];
    const seen = new Set();
    
    for (const link of allLinks) {
      if (!link.link || seen.has(link.link)) continue;
      
      // Skip Google Drive links
      if (link.link.includes('drive.google.com') || link.link.includes('docs.google.com')) {
        continue;
      }
      
      // Parse size to check if <2GB
      let sizeMB = 0;
      const sizeText = link.size.toUpperCase();
      if (sizeText.includes('GB')) {
        sizeMB = parseFloat(sizeText) * 1024;
      } else if (sizeText.includes('MB')) {
        sizeMB = parseFloat(sizeText);
      } else {
        sizeMB = 500; // Assume 500MB
      }
      
      // Only include if size < 2GB
      if (sizeMB <= 2048) {
        processedLinks.push({
          link: link.link,
          quality: normalizeQuality(link.quality),
          size: link.size || '~500MB',
          type: link.type || 'direct'
        });
        seen.add(link.link);
      }
    }
    
    // Remove duplicates and sort by quality (1080p > 720p > 480p)
    const qualityOrder = { '1080p': 1, '720p': 2, '480p': 3, '360p': 4, 'Unknown': 5 };
    processedLinks.sort((a, b) => {
      const aOrder = qualityOrder[a.quality] || 999;
      const bOrder = qualityOrder[b.quality] || 999;
      return aOrder - bOrder;
    });
    
    return processedLinks;
    
  } catch (error) {
    console.error("Get direct links error:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// -----------------------------
// Main Command - Search Movies
// -----------------------------
cmd({
  pattern: "film",
  alias: ["sinhalasub", "movies", "cinema", "download", "direct"],
  react: "🎬",
  desc: "Download Sinhala subbed movies from Cinesubz.lk (Direct Links)",
  category: "download",
  filename: __filename
}, async (maliya, mek, m, { from, q, sender, reply }) => {
  
  if (!q) {
    return reply(`*🎬 CINESUBZ.LK DIRECT DOWNLOADER*\n\n*Usage:* .film <movie name>\n*Example:* .film avengers\n*Example:* .film jawan\n*Example:* .film leo\n\n*✅ Direct Download Links Only*`);
  }
  
  reply(`*🔍 Searching for:* ${q}\n*📡 Source:* cinesubz.lk\n*⏳ Please wait...*`);
  
  try {
    const results = await searchMovies(q);
    
    if (!results || results.length === 0) {
      return reply(`*❌ No movies found for "${q}"*\n\n• Try different spelling\n• Use English movie names\n• Example: .film avatar`);
    }
    
    pendingSearch[sender] = {
      results: results,
      timestamp: Date.now()
    };
    
    let msg = `*🎬 CINESUBZ.LK - SEARCH RESULTS*\n\n`;
    msg += `*🔍 Query:* ${q}\n*📊 Found:* ${results.length} movies\n\n`;
    
    results.forEach((movie, i) => {
      msg += `*${i+1}.* ${movie.title}\n`;
      msg += `   📝 *Language:* ${movie.language || 'Sinhala Sub'}\n`;
      msg += `   📊 *Quality:* ${movie.quality || 'HD'}\n`;
      msg += `   🎞️ *Format:* ${movie.qty || 'MP4'}\n\n`;
    });
    
    msg += `*✅ Reply with number (1-${results.length}) to get DIRECT download links*`;
    msg += `\n*📤 Links are direct - No Google Drive*`;
    
    // Try to send with thumbnail
    if (results[0]?.thumb) {
      await maliya.sendMessage(from, { 
        image: { url: results[0].thumb }, 
        caption: msg 
      }, { quoted: mek }).catch(() => {
        maliya.sendMessage(from, { text: msg }, { quoted: mek });
      });
    } else {
      await maliya.sendMessage(from, { text: msg }, { quoted: mek });
    }
    
  } catch (error) {
    console.error("Main command error:", error);
    reply(`*❌ Search failed!*\n${error.message}`);
  }
});

// -----------------------------
// Filter 1 - Select Movie
// -----------------------------
cmd({
  filter: (text, { sender }) => {
    return pendingSearch[sender] && 
           !isNaN(text) && 
           parseInt(text) > 0 && 
           parseInt(text) <= pendingSearch[sender].results.length;
  }
}, async (maliya, mek, m, { body, sender, reply, from }) => {
  
  await maliya.sendMessage(from, { react: { text: "✅", key: m.key } });
  
  const index = parseInt(body) - 1;
  const selected = pendingSearch[sender].results[index];
  delete pendingSearch[sender];
  
  reply(`*📥 Loading movie details...*\n*🎬 ${selected.title}*`);
  
  try {
    // Get movie metadata
    const metadata = await getMovieMetadata(selected.movieUrl);
    
    let details = `*🎬 ${metadata.title || selected.title}*\n\n`;
    details += `*📝 Language:* ${metadata.language || selected.language || 'Sinhala Sub'}\n`;
    details += `*⏱️ Duration:* ${metadata.duration || 'N/A'}\n`;
    details += `*⭐ IMDb:* ${metadata.imdb || 'N/A'}\n`;
    details += `*🎭 Genres:* ${metadata.genres?.join(', ') || 'N/A'}\n`;
    details += `*🎥 Directors:* ${metadata.directors?.join(', ') || 'N/A'}\n`;
    details += `*🌟 Stars:* ${metadata.stars?.slice(0, 3).join(', ') || 'N/A'}\n\n`;
    details += `*🔍 Fetching DIRECT download links...*\n*⏳ This may take 30-60 seconds*`;
    
    await maliya.sendMessage(from, { text: details }, { quoted: mek });
    
    // Get DIRECT download links (NO GOOGLE DRIVE)
    const directLinks = await getDirectDownloadLinks(selected.movieUrl);
    
    if (!directLinks || directLinks.length === 0) {
      return reply(`*❌ No direct download links found!*\n\n• Movie might be removed\n• Links are expired\n• Try another movie\n\n*🔗 Manual check:*\n${selected.movieUrl}`);
    }
    
    // Store for quality selection
    pendingQuality[sender] = {
      movie: {
        title: metadata.title || selected.title,
        url: selected.movieUrl,
        links: directLinks
      },
      timestamp: Date.now()
    };
    
    let qualityMsg = `*📥 DIRECT DOWNLOAD LINKS*\n`;
    qualityMsg += `*🎬 ${metadata.title || selected.title}*\n\n`;
    
    directLinks.forEach((link, i) => {
      qualityMsg += `*${i+1}.* *${link.quality}*\n`;
      qualityMsg += `   💾 Size: ${link.size || '~500MB'}\n`;
      qualityMsg += `   🔗 Direct MP4\n\n`;
    });
    
    qualityMsg += `*✅ Reply with quality number (1-${directLinks.length})*\n`;
    qualityMsg += `*📤 Bot will send the file directly*`;
    
    await maliya.sendMessage(from, { text: qualityMsg }, { quoted: mek });
    
  } catch (error) {
    console.error("Movie selection error:", error);
    reply(`*❌ Failed to get movie details!*\n${error.message}`);
  }
});

// -----------------------------
// Filter 2 - Select Quality & Send DIRECT Link
// -----------------------------
cmd({
  filter: (text, { sender }) => {
    return pendingQuality[sender] && 
           !isNaN(text) && 
           parseInt(text) > 0 && 
           parseInt(text) <= pendingQuality[sender].movie.links.length;
  }
}, async (maliya, mek, m, { body, sender, reply, from }) => {
  
  await maliya.sendMessage(from, { react: { text: "✅", key: m.key } });
  
  const index = parseInt(body) - 1;
  const data = pendingQuality[sender];
  const selected = data.movie.links[index];
  const movieTitle = data.movie.title;
  
  delete pendingQuality[sender];
  
  reply(`*⬇️ Preparing DIRECT download...*\n*📊 Quality:* ${selected.quality}\n*💾 Size:* ${selected.size || 'Unknown'}\n*⏳ Sending as document...*`);
  
  try {
    // Clean filename
    const cleanTitle = movieTitle.replace(/[^\w\s]/gi, '').substring(0, 40).trim();
    const fileName = `${cleanTitle} - ${selected.quality}.mp4`;
    
    // Send as document - DIRECT LINK
    await maliya.sendMessage(from, {
      document: { url: selected.link },
      mimetype: "video/mp4",
      fileName: fileName,
      caption: `*🎬 ${movieTitle}*\n` +
               `*📊 Quality:* ${selected.quality}\n` +
               `*💾 Size:* ${selected.size || 'Unknown'}\n` +
               `*🔗 Source:* Cinesubz.lk Direct\n\n` +
               `*✅ Downloaded via MALIYA-MD Bot*\n` +
               `*🍿 Enjoy your Sinhala subbed movie!*`
    }, { quoted: mek });
    
    await maliya.sendMessage(from, { react: { text: "📤", key: m.key } });
    
  } catch (error) {
    console.error("Send error:", error);
    
    // Fallback: Send the direct link
    reply(`*❌ Cannot send as document!*\n\n` +
          `*🎬 ${movieTitle} - ${selected.quality}*\n` +
          `*💾 Size:* ${selected.size || 'Unknown'}\n\n` +
          `*🔗 DIRECT DOWNLOAD LINK:*\n${selected.link}\n\n` +
          `*📱 Copy and open in browser*\n` +
          `*⚠️ Link expires in 24 hours*`);
  }
});

// -----------------------------
// Cleanup old sessions
// -----------------------------
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minutes
  
  for (const s in pendingSearch) {
    if (now - pendingSearch[s].timestamp > timeout) {
      delete pendingSearch[s];
    }
  }
  for (const s in pendingQuality) {
    if (now - pendingQuality[s].timestamp > timeout) {
      delete pendingQuality[s];
    }
  }
}, 5 * 60 * 1000);

module.exports = { 
  pendingSearch, 
  pendingQuality,
  searchMovies,
  getMovieMetadata,
  getDirectDownloadLinks
};
