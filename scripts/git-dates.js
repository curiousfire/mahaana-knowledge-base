/**
 * Last-commit date for every file under a directory, from one `git log` call.
 *
 * Used so sitemap <lastmod> reflects when an FAQ was actually edited rather
 * than when the build ran (every file in a fresh Netlify checkout has the
 * build's own mtime, which made every page look changed on every deploy).
 *
 * Never throws: if git is missing or this isn't a repo, it returns an empty
 * Map and callers fall back to the old behaviour.
 */

const { execFileSync } = require("child_process");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");

/** Map of absolute file path -> "YYYY-MM-DD" of the newest commit touching it. */
function lastCommitDates(dir) {
  const dates = new Map();
  try {
    if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
      console.warn(
        "⚠️  Shallow git clone: files unchanged within the clone depth will share its oldest commit date."
      );
    }

    // Newest commits come first, so the first date seen for a path is its latest.
    // core.quotePath=false keeps non-ASCII and spaced paths unescaped.
    const log = git([
      "-c", "core.quotePath=false",
      "log", "--format=@@%cI", "--name-only", "--", path.relative(REPO_ROOT, dir),
    ]);

    let current = null;
    for (const line of log.split("\n")) {
      if (line.startsWith("@@")) {
        current = line.slice(2, 12);
      } else if (line && current) {
        const abs = path.join(REPO_ROOT, line);
        if (!dates.has(abs)) dates.set(abs, current);
      }
    }
  } catch (err) {
    console.warn("⚠️  Could not read git history (" + err.message.split("\n")[0] + "); using build date.");
  }
  return dates;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

module.exports = { lastCommitDates, REPO_ROOT };
