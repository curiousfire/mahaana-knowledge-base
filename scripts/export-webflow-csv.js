/**
 * Exports one FAQ collection as a CSV ready to import into the Webflow
 * "Need Help FAQs" CMS collection.
 *
 * Column names match a Webflow export of that collection exactly, so the
 * importer auto-maps them. Webflow system columns (Item ID, Collection ID,
 * Locale ID, the date fields) are deliberately omitted: including an Item ID
 * makes Webflow update existing items instead of creating new ones.
 *
 * Usage:
 *   node scripts/export-webflow-csv.js --collection "Mahaana Islamic Gold Fund" \
 *        --category "Mahaana Islamic Gold Fund" --order 10 --icon <url> --out <path>
 *
 * Only --collection is required; --category defaults to the collection's
 * display name from content/faq_collections.
 *
 * NOTE: a CSV import only creates and updates. Items deleted from the markdown
 * are NOT removed from Webflow by importing this file - delete those by hand.
 * Pass --diff <old.csv> to list exactly which slugs those are.
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const FAQ_ROOT = path.join(__dirname, "../content/faqs");
const COLLECTIONS_DIR = path.join(__dirname, "../content/faq_collections");

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const COLLECTION = arg("collection");
if (!COLLECTION) {
  console.error('❌ --collection is required, e.g. --collection "Mahaana Islamic Gold Fund"');
  process.exit(1);
}

const SRC_DIR = path.join(FAQ_ROOT, COLLECTION);
if (!fs.existsSync(SRC_DIR)) {
  console.error("❌ No such collection folder: " + SRC_DIR);
  process.exit(1);
}

// display name from the collection definition, if there is one
let displayName = COLLECTION;
if (fs.existsSync(COLLECTIONS_DIR)) {
  for (const file of fs.readdirSync(COLLECTIONS_DIR).filter((f) => f.endsWith(".md"))) {
    const { data } = matter(fs.readFileSync(path.join(COLLECTIONS_DIR, file), "utf8"));
    if (data.folder === COLLECTION && data.name) displayName = String(data.name).trim();
  }
}

const CATEGORY = arg("category", displayName);
const ORDER = arg("order", "");
const ICON = arg("icon", "");
const OUT = arg("out", path.join(process.cwd(), CATEGORY + " - webflow.csv"));
const DIFF = arg("diff");

// ---------------------------------------------------------------- helpers

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Folded YAML (">") turns a blank line into a single \n, so any remaining
// newline marks a paragraph break. Emit single-line HTML, matching the format
// already used by every item in the Webflow collection.
const toHtml = (answer) =>
  String(answer)
    .replace(/^\s*A:\s*/, "")
    .trim()
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => "<p>" + escHtml(p) + "</p>")
    .join("");

const escCsv = (v) => {
  v = v == null ? "" : String(v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

function parseCsv(t) {
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\r") {}
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const head = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((c) => c && c.trim()))
    .map((r) => { const o = {}; head.forEach((k, i) => (o[k] = r[i] == null ? "" : r[i])); return o; });
}

// ---------------------------------------------------------------- build

const rows = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data } = matter(fs.readFileSync(path.join(SRC_DIR, f), "utf8"));
    return {
      Question: String(data.question).trim(),
      Slug: slugify(String(data.question)),
      Answer: toHtml(data.answer),
      Category: CATEGORY,
      isTrending: "false",
      categoryIcon: ICON,
      categoryOrder: "",
      Archived: "false",
      Draft: "false",
    };
  })
  .sort((a, b) => a.Question.localeCompare(b.Question));

const dupes = rows.map((r) => r.Slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) {
  console.error("❌ Duplicate slugs, refusing to write: " + [...new Set(dupes)].join(", "));
  process.exit(1);
}

// categoryOrder is carried by exactly one representative item per category
if (ORDER) rows[0].categoryOrder = String(ORDER);

const HEADERS = [
  "Question", "Slug", "Answer", "Category",
  "isTrending", "categoryIcon", "categoryOrder", "Archived", "Draft",
];

const csv =
  [HEADERS.join(",")]
    .concat(rows.map((r) => HEADERS.map((h) => escCsv(r[h])).join(",")))
    .join("\r\n") + "\r\n";

fs.writeFileSync(OUT, "\ufeff" + csv, "utf8");

console.log("✅ Wrote " + OUT);
console.log("   " + rows.length + " rows | category: " + CATEGORY + (ORDER ? " | order: " + ORDER : ""));
if (!ICON) console.log("   ⚠️  categoryIcon is empty - pass --icon <url> to fill it");

// ---------------------------------------------------------------- diff

if (DIFF) {
  if (!fs.existsSync(DIFF)) {
    console.error("\n❌ --diff file not found: " + DIFF);
    process.exit(1);
  }
  const prev = parseCsv(fs.readFileSync(DIFF, "utf8"));
  const prevBySlug = new Map(prev.map((r) => [r.Slug, r]));
  const nowSlugs = new Set(rows.map((r) => r.Slug));

  const removed = prev.filter((r) => !nowSlugs.has(r.Slug));
  const added = rows.filter((r) => !prevBySlug.has(r.Slug));
  const changed = rows.filter(
    (r) => prevBySlug.has(r.Slug) && prevBySlug.get(r.Slug).Answer !== r.Answer
  );

  console.log("\n--- diff vs " + path.basename(DIFF) + " (" + prev.length + " -> " + rows.length + ") ---");
  console.log("\nDELETE these from Webflow by hand (" + removed.length + "):");
  removed.forEach((r) => console.log("   " + r.Slug));
  console.log("\nNEW items the import will create (" + added.length + "):");
  added.forEach((r) => console.log("   " + r.Slug));
  console.log("\nExisting items whose answer changed (" + changed.length + "):");
  changed.forEach((r) => console.log("   " + r.Slug));
}
