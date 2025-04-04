const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const basePath = "./content/faqs";
const categories = ["general", "account", "investments"];
const allFaqs = [];

categories.forEach((category) => {
  const folderPath = path.join(basePath, category);
  const files = fs.readdirSync(folderPath);

  files.forEach((file) => {
    const content = fs.readFileSync(path.join(folderPath, file), "utf8");
    const data = matter(content).data;
    allFaqs.push({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      question: data.question,
      answer: data.answer,
    });
  });
});

// Output combined FAQ JSON
fs.writeFileSync("./public/faq.json", JSON.stringify({ faqs: allFaqs }, null, 2));
console.log("✅ Generated faq.json");
