const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { lastCommitDates } = require("./git-dates");

// Base path to markdown folders
const basePath = path.join(__dirname, "../content/faqs");
const allFaqs = [];
const updatedDates = []; // parallel to allFaqs; kept out of faq.json so the SPA's data is unchanged
const commitDates = lastCommitDates(basePath);

// Recursively walk through all folders and markdown files
function walkFolders(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkFolders(entryPath); // recurse into subfolder
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const content = fs.readFileSync(entryPath, "utf8");
        const { data } = matter(content);

        if (data.question && data.answer) {
          const category = path.basename(path.dirname(entryPath));
          allFaqs.push({
            category,
            question: data.question,
            answer: data.answer,
          });
          // Uncommitted local edits have no git date; null lets the sitemap fall back.
          updatedDates.push(commitDates.get(entryPath) || null);
        } else {
          console.warn(`⚠️ Skipping file (missing question/answer): ${entryPath}`);
        }
      } catch (err) {
        console.error(`❌ Error parsing file ${entryPath}: ${err.message}`);
      }
    }
  }
}

// Run the folder scan
walkFolders(basePath);

// Ensure public directory exists
const publicDir = path.join(__dirname, "../public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write the JSON file
const outputPath = path.join(publicDir, "faq.json");
fs.writeFileSync(outputPath, JSON.stringify({ faqs: allFaqs }, null, 2), "utf8");

console.log(`✅ Generated ${outputPath} with ${allFaqs.length} FAQs.`);

// Last-edited date per FAQ, read by generate-pages.js to build sitemap <lastmod>.
const cacheDir = path.join(__dirname, "../.cache");
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(path.join(cacheDir, "faq-updated.json"), JSON.stringify(updatedDates), "utf8");
const dated = updatedDates.filter(Boolean).length;
console.log(`✅ Found last-edited dates for ${dated} of ${allFaqs.length} FAQs.`);
