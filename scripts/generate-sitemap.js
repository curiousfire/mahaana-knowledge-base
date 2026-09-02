/**
 * Walks the finished public/ directory and writes sitemap.xml + robots.txt.
 *
 * Deliberately makes no assumption about the URL pattern: it discovers whatever
 * the earlier build steps actually emitted, so it stays correct if the page
 * generator changes. Runs last in the build chain.
 *
 * Base URL comes from Netlify's own environment so preview and branch deploys
 * advertise themselves rather than production:
 *   URL               - the production site URL
 *   DEPLOY_PRIME_URL  - this specific deploy (branch / preview)
 *   CONTEXT           - "production" | "deploy-preview" | "branch-deploy"
 */

const fs = require("fs");
const path = require("path");
const { siteUrl } = require("./site-url");

const PUBLIC_DIR = path.join(__dirname, "../public");

// Paths that must never be advertised to a crawler.
const EXCLUDED_DIRS = new Set(["admin"]);

/** Recursively collect every .html file under dir, as paths relative to PUBLIC_DIR. */
function collectHtml(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path.relative(PUBLIC_DIR, full).split(path.sep)[0];
      if (EXCLUDED_DIRS.has(rel)) continue;
      collectHtml(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/** public/faq/fees/index.html -> /faq/fees/   |   public/index.html -> / */
function toUrlPath(absFile) {
  const rel = path.relative(PUBLIC_DIR, absFile).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel;
}

const escXml = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// ---------------------------------------------------------------- run

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error("❌ public/ not found. Run the build steps before this one.");
  process.exit(1);
}

const baseUrl = siteUrl();

const entries = collectHtml(PUBLIC_DIR)
  .map((file) => ({
    loc: baseUrl + toUrlPath(file),
    lastmod: fs.statSync(file).mtime.toISOString().slice(0, 10),
    // "/" first, then shallower paths, then alphabetical - keeps the file readable.
    sortKey: toUrlPath(file),
  }))
  .sort((a, b) => {
    if (a.sortKey === "/") return -1;
    if (b.sortKey === "/") return 1;
    const depth = a.sortKey.split("/").length - b.sortKey.split("/").length;
    return depth !== 0 ? depth : a.sortKey.localeCompare(b.sortKey);
  });

if (!entries.length) {
  console.error("❌ No HTML pages found under public/; refusing to write an empty sitemap.");
  process.exit(1);
}

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries
    .map(
      (e) =>
        "  <url>\n" +
        "    <loc>" + escXml(e.loc) + "</loc>\n" +
        "    <lastmod>" + e.lastmod + "</lastmod>\n" +
        "  </url>"
    )
    .join("\n") +
  "\n</urlset>\n";

fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemap, "utf8");

const robots =
  "User-agent: *\n" +
  "Allow: /\n" +
  "Disallow: /admin/\n" +
  "\n" +
  "Sitemap: " + baseUrl + "/sitemap.xml\n";

fs.writeFileSync(path.join(PUBLIC_DIR, "robots.txt"), robots, "utf8");

console.log(
  "✅ Generated public/sitemap.xml with " + entries.length + " URLs (base: " + baseUrl + ")"
);
console.log("✅ Generated public/robots.txt pointing at " + baseUrl + "/sitemap.xml");

if (entries.length < 10) {
  console.warn(
    "\n⚠️  Only " + entries.length + " URL(s) found. If you expected one page per FAQ,\n" +
      "   the page generator is not emitting them - check generate-pages.js ran.\n"
  );
}
