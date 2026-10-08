(function () {
  "use strict";

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      }
    });
  }

  // Header border once the page scrolls
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

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
    groups.forEach(function (g) {
      g.hidden = !g.querySelector(".pub:not([hidden])");
    });
    count.textContent = shown === items.length
      ? items.length + " publications"
      : "Showing " + shown + " of " + items.length + " publications";
    empty.hidden = shown !== 0;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      active = btn.getAttribute("data-filter");
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      apply();
    });
  });
  search.addEventListener("input", apply);

  // Allow linking to a topic, e.g. publications.html#mental
  var hash = window.location.hash.replace("#", "");
  var preset = buttons.filter(function (b) { return b.getAttribute("data-filter") === hash; })[0];
  if (preset) preset.click(); else apply();
})();
