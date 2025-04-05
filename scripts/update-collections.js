const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const yaml = require("js-yaml");

// Path to the collections directory
const collectionsPath = "./content/faq_collections";
// Path to the config.yml file
const configPath = "./public/admin/config.yml";

// Create collections directory if it doesn't exist
if (!fs.existsSync(collectionsPath)) {
  fs.mkdirSync(collectionsPath, { recursive: true });
  console.log(`Created directory: ${collectionsPath}`);
}

// Read the current config.yml
let config;
try {
  const configContent = fs.readFileSync(configPath, "utf8");
  config = yaml.load(configContent);
} catch (err) {
  console.error(`Error reading config file: ${err.message}`);
  process.exit(1);
}

// Keep only the faq_collections collection
const defaultCollections = config.collections.filter(collection => 
  ["faq_collections"].includes(collection.name)
);

// Read all collection definitions from the collections directory
const dynamicCollections = [];
if (fs.existsSync(collectionsPath)) {
  const files = fs.readdirSync(collectionsPath);
  
  files.forEach(file => {
    if (!file.endsWith('.md')) return;
    
    try {
      const content = fs.readFileSync(path.join(collectionsPath, file), "utf8");
      const data = matter(content).data;
      
      if (data.name && data.folder) {
        // Create the collection definition
        const collection = {
          name: `${data.folder}_faqs`,
          label: `${data.name} FAQs`,
          folder: `content/faqs/${data.folder}`,
          create: true,
          slug: "{{slug}}",
          identifier_field: "question",
          fields: [
            {
              label: "Question",
              name: "question",
              widget: "string"
            },
            {
              label: "Answer",
              name: "answer",
              widget: "text"
            }
          ]
        };
        
        dynamicCollections.push(collection);
        
        // Create the folder for this collection if it doesn't exist
        const folderPath = `content/faqs/${data.folder}`;
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
          console.log(`Created directory: ${folderPath}`);
        }
      }
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
    }
  });
}

// Merge default and dynamic collections
config.collections = [...defaultCollections, ...dynamicCollections];

// Write the updated config back to the file
try {
  fs.writeFileSync(configPath, yaml.dump(config));
  console.log("✅ Updated config.yml with dynamic collections");
} catch (err) {
  console.error(`Error writing config file: ${err.message}`);
}
