const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// Base path to markdown folders
const basePath = path.join(__dirname, "../content/faqs");
const allFaqs = [];

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
