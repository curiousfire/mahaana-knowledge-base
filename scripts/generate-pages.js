/**
 * Emits one crawlable static HTML page per FAQ.
 *
 * The site itself is an Alpine.js SPA: public/index.html fetches /faq.json and
 * renders every FAQ client-side into a single "/" document. That means a crawler
 * (Vertex, Google, anything) sees exactly one page of content no matter how many
 * FAQs exist. This script materialises real URLs so there is something to index:
 *
 *   /faq/                                 full index
 *   /faq/<category>/                      category index
 *   /faq/<category>/<question-slug>/      one page per FAQ, with FAQPage JSON-LD
 *
 * Runs after generate-faq.js (it consumes public/faq.json) and before
 * generate-sitemap.js (which walks whatever this leaves behind).
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { siteUrl } = require("./site-url");

const PUBLIC_DIR = path.join(__dirname, "../public");
const FAQ_JSON = path.join(PUBLIC_DIR, "faq.json");
const COLLECTIONS_DIR = path.join(__dirname, "../content/faq_collections");
const OUT_ROOT = path.join(PUBLIC_DIR, "faq");

const SITE_NAME = "Mahaana Knowledge Base";
const BASE_URL = siteUrl();

// ---------------------------------------------------------------- helpers

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "untitled";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Answers arrive as plain text from YAML folded scalars. Many still carry a
// stray "A: " prefix from the original CSV conversion; strip it for display so
// indexed pages do not lead with transcript noise. The source files still have
// it -- see the warning this script prints at the end.
const cleanAnswer = (s) =>
  String(s || "")
    .replace(/^\s*A:\s*/, "")
    .trim();

// Escape first, then linkify, so no markup can arrive through content.
const renderAnswer = (raw) =>
  cleanAnswer(raw)
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      let html = esc(para.replace(/\s*\n\s*/g, " "));
      html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" rel="noopener">$1</a>'
      );
      html = html.replace(
        /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
        '$1<a href="$2" rel="noopener">$2</a>'
      );
      return "<p>" + html + "</p>";
    })
    .join("\n      ");

const metaDescription = (raw) => {
  const text = cleanAnswer(raw).replace(/\s+/g, " ");
  return text.length > 155 ? text.slice(0, 152).trimEnd() + "..." : text;
};

const write = (relDir, html) => {
  const dir = path.join(OUT_ROOT, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
};

// ---------------------------------------------------------------- shared chrome

const STYLE = `
    :root {
      --primary:#4F46E5; --primary-dark:#4338CA; --bg:#F9FAFB; --card:#fff;
      --text:#374151; --heading:#1F2937; --muted:#6B7280; --line:#E5E7EB;
      --shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -1px rgba(0,0,0,.06);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg:#111827; --card:#1F2937; --text:#F9FAFB; --heading:#F9FAFB;
        --muted:#D1D5DB; --line:#374151;
      }
    }
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      background:var(--bg);color:var(--text);line-height:1.65}
    .wrap{max-width:760px;margin:0 auto;padding:2rem 1.25rem 4rem}
    nav.crumbs{font-size:.85rem;color:var(--muted);margin-bottom:1.5rem}
    nav.crumbs a{color:var(--primary);text-decoration:none}
    nav.crumbs a:hover{text-decoration:underline}
    h1{font-size:1.9rem;font-weight:800;color:var(--heading);line-height:1.25;margin-bottom:1.25rem}
    h2{font-size:1.15rem;font-weight:700;color:var(--heading);margin:2.25rem 0 .75rem}
    h2 a{text-decoration:none}
    .answer{background:var(--card);padding:1.5rem;border-radius:10px;box-shadow:var(--shadow)}
    .answer p+p{margin-top:1rem}
    a{color:var(--primary)}
    ul.links{list-style:none;margin-top:.5rem}
    ul.links li{border-bottom:1px solid var(--line)}
    ul.links li:last-child{border-bottom:none}
    ul.links a{display:block;padding:.7rem .25rem;text-decoration:none;font-weight:500}
    ul.links a:hover{color:var(--primary-dark);text-decoration:underline}
    .count{color:var(--muted);font-weight:400;font-size:.9rem}
    footer{margin-top:3rem;padding-top:1.25rem;border-top:1px solid var(--line);
      font-size:.85rem;color:var(--muted)}
    footer a{text-decoration:none}`;

const page = ({ title, description, canonicalPath, jsonLd, body }) =>
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
  '  <meta charset="UTF-8" />\n' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
  "  <title>" + esc(title) + " | " + SITE_NAME + "</title>\n" +
  '  <meta name="description" content="' + esc(description) + '" />\n' +
  '  <link rel="canonical" href="' + BASE_URL + canonicalPath + '" />\n' +
  '  <meta property="og:type" content="article" />\n' +
  '  <meta property="og:title" content="' + esc(title) + '" />\n' +
  '  <meta property="og:description" content="' + esc(description) + '" />\n' +
  '  <meta property="og:url" content="' + BASE_URL + canonicalPath + '" />\n' +
  "  <style>" + STYLE + "\n  </style>\n" +
  (jsonLd
    ? '  <script type="application/ld+json">\n' +
      JSON.stringify(jsonLd, null, 2) +
      "\n  </script>\n"
    : "") +
  "</head>\n<body>\n  <div class=\"wrap\">\n" +
  body +
  "\n    <footer>\n" +
  '      <a href="/">' + SITE_NAME + "</a> &middot; " +
  '<a href="/faq/">All questions</a>\n' +
  "    </footer>\n  </div>\n</body>\n</html>\n";

// ---------------------------------------------------------------- load data

if (!fs.existsSync(FAQ_JSON)) {
  console.error("\u274c " + FAQ_JSON + " not found. Run generate-faq.js first.");
  process.exit(1);
}

const faqs = JSON.parse(fs.readFileSync(FAQ_JSON, "utf8")).faqs || [];
if (!faqs.length) {
  console.error("\u274c faq.json contains no FAQs; refusing to emit an empty site.");
  process.exit(1);
}

// folder -> pretty label, taken from the collection definitions
const labels = {};
if (fs.existsSync(COLLECTIONS_DIR)) {
  const files = fs.readdirSync(COLLECTIONS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const { data } = matter(fs.readFileSync(path.join(COLLECTIONS_DIR, file), "utf8"));
    if (data.folder && data.name) {
      labels[data.folder] = {
        name: String(data.name).trim(),
        description: String(data.description || "").replace(/\s+/g, " ").trim(),
      };
    }
  }
}

// ---------------------------------------------------------------- group + slug

const collisions = [];
const categories = new Map();

for (const faq of faqs) {
  const folder = faq.category || "General";
  const catSlug = slugify(folder);

  if (!categories.has(catSlug)) {
    const meta = labels[folder] || {};
    categories.set(catSlug, {
      folder: folder,
      slug: catSlug,
      label: meta.name || folder,
      description: meta.description || "",
      items: [],
      seen: new Set(),
    });
  }
  const cat = categories.get(catSlug);

  let slug = slugify(faq.question);
  if (cat.seen.has(slug)) {
    // Two questions slugify identically. Suffix rather than silently overwrite,
    // and report it -- a duplicate question is a content bug worth fixing.
    const base = slug;
    let n = 2;
    while (cat.seen.has(base + "-" + n)) n++;
    slug = base + "-" + n;
    collisions.push({ category: folder, question: faq.question, resolvedAs: slug });
  }
  cat.seen.add(slug);
  cat.items.push({
    question: faq.question,
    answer: faq.answer,
    slug: slug,
    url: "/faq/" + catSlug + "/" + slug + "/",
  });
}

const allCategories = Array.from(categories.values()).sort((a, b) =>
  a.label.localeCompare(b.label)
);

// ---------------------------------------------------------------- emit

if (fs.existsSync(OUT_ROOT)) fs.rmSync(OUT_ROOT, { recursive: true, force: true });

let faqPages = 0;

for (const cat of allCategories) {
  for (const item of cat.items) {
    const related = cat.items
      .filter((o) => o.slug !== item.slug)
      .slice(0, 6)
      .map((o) => '        <li><a href="' + o.url + '">' + esc(o.question) + "</a></li>")
      .join("\n");

    const body =
      '    <nav class="crumbs">\n' +
      '      <a href="/faq/">All questions</a> / ' +
      '<a href="/faq/' + cat.slug + '/">' + esc(cat.label) + "</a>\n" +
      "    </nav>\n" +
      "    <h1>" + esc(item.question) + "</h1>\n" +
      '    <div class="answer">\n      ' + renderAnswer(item.answer) + "\n    </div>" +
      (related
        ? "\n    <h2>More in " + esc(cat.label) + "</h2>\n" +
          '    <ul class="links">\n' + related + "\n      </ul>"
        : "");

    write(
      cat.slug + "/" + item.slug,
      page({
        title: item.question,
        description: metaDescription(item.answer),
        canonicalPath: item.url,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: cleanAnswer(item.answer).replace(/\s+/g, " "),
              },
            },
          ],
        },
        body: body,
      })
    );
    faqPages++;
  }

  // category index
  const catBody =
    '    <nav class="crumbs"><a href="/faq/">All questions</a> / ' +
    esc(cat.label) + "</nav>\n" +
    "    <h1>" + esc(cat.label) +
    ' <span class="count">(' + cat.items.length + ")</span></h1>\n" +
    (cat.description ? "    <p>" + esc(cat.description) + "</p>\n" : "") +
    '    <ul class="links">\n' +
    cat.items
      .map((i) => '        <li><a href="' + i.url + '">' + esc(i.question) + "</a></li>")
      .join("\n") +
    "\n      </ul>";

  write(
    cat.slug,
    page({
      title: cat.label,
      description:
        cat.description ||
        cat.items.length + " answers about " + cat.label + " from " + SITE_NAME + ".",
      canonicalPath: "/faq/" + cat.slug + "/",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: cat.items.map((i) => ({
          "@type": "Question",
          name: i.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: cleanAnswer(i.answer).replace(/\s+/g, " "),
          },
        })),
      },
      body: catBody,
    })
  );
}

// master index
const indexBody =
  '    <nav class="crumbs"><a href="/">Home</a> / All questions</nav>\n' +
  '    <h1>All questions <span class="count">(' + faqs.length + ")</span></h1>\n" +
  allCategories
    .map(
      (cat) =>
        '    <h2><a href="/faq/' + cat.slug + '/">' + esc(cat.label) + "</a> " +
        '<span class="count">(' + cat.items.length + ")</span></h2>\n" +
        '    <ul class="links">\n' +
        cat.items
          .map((i) => '        <li><a href="' + i.url + '">' + esc(i.question) + "</a></li>")
          .join("\n") +
        "\n      </ul>"
    )
    .join("\n");

write(
  "",
  page({
    title: "All questions",
    description:
      "Browse all " + faqs.length + " answers across " + allCategories.length +
      " categories in the " + SITE_NAME + ".",
    canonicalPath: "/faq/",
    jsonLd: null,
    body: indexBody,
  })
);

// ---------------------------------------------------------------- report

const total = faqPages + allCategories.length + 1;
console.log(
  "\u2705 Generated " + total + " pages in public/faq/ (" +
    faqPages + " FAQ + " + allCategories.length + " category + 1 index)"
);

if (collisions.length) {
  console.warn(
    "\n\u26a0\ufe0f  " + collisions.length +
      " slug collision(s) - duplicate questions in source:"
  );
  collisions.forEach((c) =>
    console.warn('   [' + c.category + '] "' + c.question + '" -> kept as ' + c.resolvedAs)
  );
  console.warn("   Both pages exist, but this is duplicate content. Fix at source.\n");
}

const stillPrefixed = faqs.filter((f) => /^\s*A:\s*/.test(f.answer || "")).length;
if (stillPrefixed) {
  console.warn(
    "\u26a0\ufe0f  " + stillPrefixed + " of " + faqs.length +
      ' answers begin with a stray "A:" prefix. Stripped on these static\n' +
      "   pages, but still present in faq.json and the source markdown, so the\n" +
      '   SPA at "/" still renders it.'
  );
}
