const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const basePath = "./content/faqs";
const allFaqs = [];

// Get all directories in the faqs folder
const categories = fs.readdirSync(basePath, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

// Process each category
categories.forEach((category) => {
  const folderPath = path.join(basePath, category);
  if (!fs.existsSync(folderPath)) return;
  
  const files = fs.readdirSync(folderPath);
  files.forEach((file) => {
    if (!file.endsWith('.md')) return; // Only process markdown files
    
    const content = fs.readFileSync(path.join(folderPath, file), "utf8");
    const data = matter(content).data;
    allFaqs.push({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      question: data.question,
      answer: data.answer,
    });
  });
});

// Ensure the public directory exists
if (!fs.existsSync("public")) fs.mkdirSync("public");

// Write the FAQ data to a JSON file
fs.writeFileSync("./public/faq.json", JSON.stringify({ faqs: allFaqs }, null, 2));
console.log("✅ Generated faq.json");
