const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const basePath = path.join(__dirname, "../content/faqs");
const allFaqs = [];

// Get all directories (categories) in the faqs folder
const categories = fs.readdirSync(basePath, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

// Process each category folder
categories.forEach((category) => {
  const folderPath = path.join(basePath, category);
  if (!fs.existsSync(folderPath)) return;
  
  const files = fs.readdirSync(folderPath);
  files.forEach((file) => {
    if (!file.endsWith('.md')) return; // Only process markdown files
    
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, "utf8");
    let data;
    try {
      const parsed = matter(content);
      data = parsed.data;
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
      return;
    }
    
    // Warn if the file is missing question or answer frontmatter
    if (!data.question || !data.answer) {
      console.warn(`Warning: File ${filePath} is missing a question or answer.`);
      return;
    }
    
    allFaqs.push({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      question: data.question,
      answer: data.answer,
    });
  });
});

// Ensure the public directory exists (using recursive: true)
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write the FAQ data to a JSON file
const jsonOutput = JSON.stringify({ faqs: allFaqs }, null, 2);
fs.writeFileSync(path.join(publicDir, "faq.json"), jsonOutput, "utf8");
console.log("✅ Generated faq.json");
