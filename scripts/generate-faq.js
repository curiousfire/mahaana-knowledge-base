const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const basePath = path.join(__dirname, "../content/faqs");
const allFaqs = [];

// Get all directories (categories) in the faqs folder
const categories = fs.readdirSync(basePath, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

/**
 * Formats an answer using a YAML block scalar if it contains problematic characters.
 * This converts the answer so that inner quotes and colons don't break YAML parsing.
 */
function formatAnswer(answer) {
  // Check if answer contains a newline, colon, or double quote that might cause issues
  if (answer.includes("\n") || answer.includes(":") || answer.includes('"')) {
    // Remove surrounding quotes if present
    if (answer.startsWith('"') && answer.endsWith('"')) {
      answer = answer.slice(1, -1);
    }
    // Use block scalar formatting (with >)
    return ">\n  " + answer.replace(/\n/g, "\n  ");
  }
  // Otherwise, wrap in double quotes
  return `"${answer}"`;
}

// Process each category folder
categories.forEach((category) => {
  const folderPath = path.join(basePath, category);
  if (!fs.existsSync(folderPath)) return;
  
  const files = fs.readdirSync(folderPath);
  files.forEach((file) => {
    if (!file.endsWith('.md')) return; // Only process markdown files
    
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, "utf8");
    
    try {
      const parsed = matter(content);
      const data = parsed.data;
      
      // Warn if missing frontmatter keys
      if (!data.question || !data.answer) {
        console.warn(`Warning: File ${filePath} is missing a question or answer.`);
        return;
      }
      
      // Reformat the answer if needed
      data.answer = formatAnswer(data.answer);
      
      allFaqs.push({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        question: data.question,
        answer: data.answer,
      });
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  });
});

// Ensure the public directory exists (using recursive: true)
const projectRoot = path.join(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write the FAQ data to a JSON file
const jsonOutput = JSON.stringify({ faqs: allFaqs }, null, 2);
fs.writeFileSync(path.join(publicDir, "faq.json"), jsonOutput, "utf8");
console.log("✅ Generated faq.json");
