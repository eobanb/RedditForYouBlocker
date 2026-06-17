/**
 * content.js
 * Watches for dynamically-injected "For You" elements that slip past the CSS
 * (React/shreddit re-renders, lazy-loaded tab strips, etc.) and removes them.
 */

"use strict";

// ── Redirect "For You" feed to Following feed ────────────────────────────────
// Reddit serves ?feed=home as the default "For You" view.
// We swap it to ?feed=following (subscribed subreddits) immediately.

function redirectIfForYou() {
  const url = new URL(location.href);

  // Only act on the root home page, not subreddit pages etc.
  const isHomePage = url.pathname === "/" || url.pathname === "";

  // "For You" is served as ?feed=home, or with no feed param (bare "/")
  const feed = url.searchParams.get("feed");
  const isForYouFeed = feed === "home" || feed === null || feed === "";

  if (isHomePage && isForYouFeed) {
    url.searchParams.set("feed", "following");
    location.replace(url.toString());
  }
}

redirectIfForYou();

// ── Selectors that identify "For You" UI ────────────────────────────────────

const FOR_YOU_SELECTORS = [
  // Shreddit tab chip
  "shreddit-feed-sort-tab[tab-value='BEST']",
  "shreddit-feed-sort-tab[aria-label*='for you' i]",

  // Text-based tab buttons (React)
  "button[aria-label*='For You' i]",
  "a[aria-label*='For You' i]",

  // Feed-type selector list items containing "For You"
  "[data-testid='feed-type-selector'] li",

  // Right-rail widgets
  "[data-testid='more-posts-widget']",
  "[data-testid='recommended-posts']",
  ".recommended-posts-banner",

  // Promoted posts
  "shreddit-ad-post",
  "[data-adtype]",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function isForYouTab(el) {
  const label =
    el.getAttribute("aria-label") ||
    el.textContent ||
    el.getAttribute("value") ||
    "";
  return /for\s*you/i.test(label);
}

function hideEl(el) {
  if (el && el.style) {
    el.style.setProperty("display", "none", "important");
  }
}

function scrub(root = document) {
  // Generic selector sweep
  FOR_YOU_SELECTORS.forEach((sel) => {
    try {
      root.querySelectorAll(sel).forEach((el) => {
        if (isForYouTab(el) || sel !== "[data-testid='feed-type-selector'] li") {
          hideEl(el);
        }
      });
    } catch (_) {
      /* ignore invalid selectors in older browsers */
    }
  });

  // Catch any tab/link whose visible text is literally "For You"
  root.querySelectorAll("a, button, li").forEach((el) => {
    if (/^\s*for\s+you\s*$/i.test(el.textContent)) {
      hideEl(el.closest("li") || el);
    }
  });
}

// ── MutationObserver ─────────────────────────────────────────────────────────

const observer = new MutationObserver((mutations) => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== 1) continue; // elements only
      scrub(node);
      // Also check the node itself
      if (isForYouTab(node)) hideEl(node);
    }
  }
});

function start() {
  scrub(); // initial pass
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// Start as early as possible; body may not exist yet at document_start
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

// Re-scrub + re-check redirect on SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    redirectIfForYou();           // catch pushState navigations back to "/"
    setTimeout(scrub, 300);
    setTimeout(scrub, 800);
  }
}).observe(document, { subtree: true, childList: true });
