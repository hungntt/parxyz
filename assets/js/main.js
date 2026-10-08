(function () {
  "use strict";

  // Header: frosted background once the page scrolls
  var header = document.querySelector(".site-header");
  if (header && !header.classList.contains("solid")) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Mobile menu
  var btn = document.querySelector(".menu-btn");
  var nav = document.getElementById("nav");
  if (btn && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close" : "Menu";
    };
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  // Reveal on scroll (a scroll check rather than IntersectionObserver, so content
  // still appears in environments that never paint frames, such as some crawlers)
  var pending = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var ticking = false;
  function reveal() {
    ticking = false;
    var limit = window.innerHeight * 0.92;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < limit) { el.classList.add("in"); return false; }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener("scroll", onReveal);
      window.removeEventListener("resize", onReveal);
    }
  }
  function onReveal() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(reveal); }
  }
  window.addEventListener("scroll", onReveal, { passive: true });
  window.addEventListener("resize", onReveal);
  reveal();

  // Current year in the footer
  document.querySelectorAll("[data-current-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // Publications: search and topic filters
  var pubs = document.getElementById("pubs");
  if (!pubs) return;
  var items = Array.prototype.slice.call(pubs.querySelectorAll(".pub"));
  var groups = Array.prototype.slice.call(pubs.querySelectorAll(".year-group"));
  var search = document.getElementById("pub-search");
  var count = document.getElementById("pub-count");
  var empty = document.getElementById("pub-empty");
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".filter"));
  var active = "all";

  function apply() {
    var q = (search.value || "").trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var tags = (li.getAttribute("data-tags") || "").split(" ");
      var okTag = active === "all" || tags.indexOf(active) !== -1;
      var okText = !q || li.getAttribute("data-search").indexOf(q) !== -1;
      li.hidden = !(okTag && okText);
      if (!li.hidden) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector(".pub:not([hidden])"); });
    count.textContent = shown === items.length
      ? items.length + " publications"
      : "Showing " + shown + " of " + items.length;
    empty.hidden = shown !== 0;
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      active = b.getAttribute("data-filter");
      buttons.forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      apply();
    });
  });
  search.addEventListener("input", apply);

  // Allow linking to a topic, e.g. publications.html#mental
  var hash = window.location.hash.replace("#", "");
  var preset = buttons.filter(function (b) { return b.getAttribute("data-filter") === hash; })[0];
  if (preset) preset.click(); else apply();
})();
