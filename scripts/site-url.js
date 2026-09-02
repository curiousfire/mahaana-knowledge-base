/**
 * Single source of truth for the site's base URL, shared by generate-pages.js
 * (canonical / og:url tags) and generate-sitemap.js (<loc> entries) so the two
 * can never disagree.
 *
 * Netlify sets these during a build:
 *   URL               - the production site URL
 *   DEPLOY_PRIME_URL  - this specific deploy (branch / deploy preview)
 *   CONTEXT           - "production" | "deploy-preview" | "branch-deploy"
 *
 * On a preview we advertise the preview URL; in production, the production URL.
 */

const FALLBACK_URL = "https://loquacious-blancmange-d6f58d.netlify.app";

let warned = false;

function siteUrl() {
  const context = process.env.CONTEXT;
  const candidate =
    context && context !== "production"
      ? process.env.DEPLOY_PRIME_URL || process.env.URL
      : process.env.URL || process.env.DEPLOY_PRIME_URL;

  const base = (candidate || FALLBACK_URL).trim().replace(/\/+$/, "");

  if (!candidate && !warned) {
    warned = true;
    console.warn("⚠️  No Netlify URL / DEPLOY_PRIME_URL in env; falling back to " + base);
  }
  return base;
}

module.exports = { siteUrl, FALLBACK_URL };
