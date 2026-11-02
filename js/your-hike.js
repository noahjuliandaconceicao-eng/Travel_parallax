/* ==========================================================================
   Travel — your-hike/: the personalised recommendation page.
   Reads the saved answers + match from HikeFinder.Store and renders the trail;
   falls back to an empty state when nobody has taken the questionnaire.
   ========================================================================== */
(() => {
  "use strict";

  const HF = window.HikeFinder;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const animate = hasGsap && !reduceMotion;
  const BASE = "../";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const STRENGTH = { strong: "Strong match", good: "Good match", partial: "Closest fit" };

  $("#year").textContent = new Date().getFullYear();
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const state = HF.Store.get();
  const answers = state.answers || {};
  const result = state.result && HF.isComplete(answers) ? state.result : null;
  const trail = result && HF.trailById(result.selected);

  /* ------------------------------------------------------------------------
     Empty state — direct visit without answers
     ------------------------------------------------------------------------ */
  if (!trail) {
    renderEmpty();
    start();
    return;
  }

  const photos = HF.photosOf(trail);
  const match = result.top.find((t) => t.id === trail.id) || { percent: HF.rank(answers).find((r) => r.id === trail.id).percent };
  render();
  start();

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */
  function renderEmpty() {
    document.title = "Your Hike — Travel";
    root.classList.add("is-empty");
    setHero({ src: `${BASE}assets/img/summit-1440.webp`, alt: "Sunlit Dolomite peak above snowfields" });
    $(".yh-hero__label").textContent = "Trail finder";
    $(".yh-hero__title").textContent = "No adventure planned yet";
    $(".yh-hero__where").textContent = "Seven questions · two minutes";
    $(".yh-hero__intro").textContent = "Tell us which landscapes, challenge, weather and company you're after, and we'll match you with the trail that fits — from Lofoten to the Amalfi Coast.";
    $(".yh-hero__meta").innerHTML = `<a class="btn btn--solid" href="${BASE}#plan" data-action="restart">Start the questionnaire ${ARROW}</a>`;
    $(".yh-hero__scroll").hidden = true;
    $(".yh-cta").hidden = true;
    $(".credits").hidden = true;
  }

  function setHero(photo) {
    const img = $(".yh-hero__media img");
    img.src = photo.hero ? BASE + photo.hero : photo.src;
    img.alt = photo.alt;
  }

  function render() {
    document.title = `${trail.name} — Your Hike`;
    $(".yh-body").hidden = false;

    // A. Hero
    if (photos[0]) setHero(photos[0]);
    $(".yh-hero__title").textContent = trail.name;
    $(".yh-hero__where").textContent = `${trail.destination} · ${trail.country}`;
    $(".yh-hero__intro").textContent = HF.intro(trail, answers);
    $(".yh-hero__meta").innerHTML = [
      `<span class="chip chip--match"><b>${match.percent}%</b> match</span>`,
      `<span class="chip">${esc(HF.difficultyLabel(trail))}</span>`,
      `<span class="chip">${esc(HF.durationText(trail))}</span>`,
      `<span class="chip">${HF.km(trail.distanceKm)}</span>`,
    ].join("");

    // B. Overview
    const facts = [
      ["Destination", trail.destination],
      ["Country", trail.country],
      ["Trail", trail.name],
      ["Difficulty", HF.difficultyLabel(trail)],
      ["Distance", HF.km(trail.distanceKm)],
      ["Duration", `≈ ${HF.durationText(trail)}`],
      ["Elevation gain", HF.metres(trail.gainM)],
      ["Best season", trail.season],
      ["Typical weather", HF.weatherText(trail)],
      ["Experience level", trail.level],
    ];
    $(".facts").innerHTML = facts.map(([k, v], i) => `<div class="facts__item" style="--i:${i}"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");

    // C. Why it matches — built from the saved answers
    $(".yh-why__summary").textContent = HF.summary(trail, answers);
    $(".reasons").innerHTML = HF.explain(trail, answers).map((r, i) => `
      <li class="reason reason--${r.strength}" data-fade>
        <span class="reason__num">${pad(i + 1)}</span>
        <div class="reason__head">
          <span class="reason__q">${esc(HF.question(r.key).title)}</span>
          <span class="reason__a">You chose <b>${esc(r.answer)}</b></span>
        </div>
        <p class="reason__text">${esc(r.text)}</p>
        <span class="reason__tag">${STRENGTH[r.strength]}</span>
      </li>`).join("");

    // D. What to expect
    const bullets = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const expect = [
      ["Trail environment", `<p>${esc(trail.environment)}</p>`],
      ["Major viewpoints", bullets(trail.viewpoints.map((v) => v.charAt(0).toUpperCase() + v.slice(1)))],
      ["Terrain", `<p>${esc(trail.terrain)}</p>`],
      ["Highlights", bullets(trail.highlights)],
      ["Potential challenges", bullets(trail.challenges)],
    ];
    $(".expect").innerHTML = expect.map(([title, body], i) => `
      <li class="expect__item" data-fade>
        <span class="expect__num">${pad(i + 1)}</span>
        <h3>${title}</h3>
        ${body}
      </li>`).join("");

    // E. Gallery
    $(".gallery").innerHTML = photos.map((p, i) => `
      <figure class="gallery__item gallery__item--${i}">
        <div class="gallery__frame"><img src="${BASE + p.src}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></div>
        <figcaption>${esc(p.alt)}</figcaption>
      </figure>`).join("");

    // F. Route & practical
    const high = trail.profile.reduce((a, b) => (b[1] > a[1] ? b : a));
    $(".route__facts").innerHTML = [
      ["Starting point", trail.start.name],
      ["Trail distance", `${HF.km(trail.distanceKm)}${trail.days ? "" : trail.profile[0][2] === trail.profile[trail.profile.length - 1][2] ? " (loop or return)" : " (one way)"}`],
      ["Estimated duration", `≈ ${HF.durationText(trail)}`],
      ["High point", `≈ ${high[1].toLocaleString("en-GB")} m · ${high[2]}`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $('[data-list="gear"]').innerHTML = HF.gear(trail).map((x) => `<li>${esc(x)}</li>`).join("");
    $('[data-list="safety"]').innerHTML = HF.safety(trail).map((x) => `<li>${esc(x)}</li>`).join("");
    renderProfile();
    renderMap();

    // Other matches
    $(".more").innerHTML = result.top.filter((t) => t.id !== trail.id).slice(0, 3).map(({ id, percent }) => {
      const t = HF.trailById(id);
      const p = HF.photosOf(t)[0];
      return `
        <li class="more__card" data-fade>
          <button type="button" data-trail="${id}">
            <span class="more__media">${p ? `<img src="${BASE + p.src}" alt="" loading="lazy" decoding="async">` : ""}</span>
            <span class="more__match">${percent}% match</span>
            <span class="more__country">${esc(t.country)}</span>
            <span class="more__name">${esc(t.name)}</span>
            <span class="more__meta">${esc(HF.difficultyLabel(t))} · ${esc(HF.durationText(t))} · ${HF.km(t.distanceKm)}</span>
            <span class="more__cta">View this hike ${ARROW}</span>
          </button>
        </li>`;
    }).join("");

    // Credits
    $(".credits__list").innerHTML = photos.map((p) =>
      `<li>${esc(p.alt)} — <a href="${esc(p.page)}" rel="noopener">${esc(p.credit)}</a>, Wikimedia Commons, ${esc(p.license)}, resized</li>`).join("") +
      '<li>Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a></li>';
  }

  function renderProfile() {
    const pts = trail.profile;
    const W = 800, H = 220, P = { t: 26, r: 16, b: 28, l: 52 };
    const maxKm = pts[pts.length - 1][0] || 1;
    const alts = pts.map((p) => p[1]);
    const span = Math.max(...alts) - Math.min(...alts) || 100;
    const lo = Math.max(0, Math.min(...alts) - span * 0.25);
    const hi = Math.max(...alts) + span * 0.15;
    const x = (km) => P.l + (km / maxKm) * (W - P.l - P.r);
    const y = (alt) => P.t + (1 - (alt - lo) / (hi - lo)) * (H - P.t - P.b);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
    const area = `${line} L${x(maxKm).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
    const ticks = [lo, (lo + hi) / 2, hi].map((a) => Math.round(a / 50) * 50);
    const unit = trail.days ? "km (whole trek)" : "km";

    $(".profile__chart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Simplified elevation profile from ${pts[0][1]} m to a high point of ${Math.max(...alts)} m over ${maxKm} km">
        <defs><linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((a) => `<g class="profile__tick"><line x1="${P.l}" x2="${W - P.r}" y1="${y(a)}" y2="${y(a)}"/><text x="${P.l - 8}" y="${y(a) + 4}" text-anchor="end">${a.toLocaleString("en-GB")} m</text></g>`).join("")}
        <path class="profile__area" d="${area}" fill="url(#pf)"/>
        <path class="profile__line" d="${line}" pathLength="1"/>
        ${pts.map((p) => `<circle class="profile__dot" cx="${x(p[0])}" cy="${y(p[1])}" r="4"><title>${esc(p[2])} · ${p[1]} m</title></circle>`).join("")}
        <text class="profile__axis" x="${W - P.r}" y="${H - 6}" text-anchor="end">${maxKm} ${unit}</text>
        <text class="profile__axis" x="${P.l}" y="${H - 6}">0</text>
      </svg>`;
    $(".profile__points").innerHTML = pts.map((p) =>
      `<li><span>${esc(p[2])}</span><span>km ${p[0]} · ${p[1].toLocaleString("en-GB")} m</span></li>`).join("");
  }

  function renderMap() {
    const { lat, lng, name } = trail.start;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;
    $(".route__caption").innerHTML = `Trailhead (approximate): ${esc(name)} · ${lat.toFixed(3)}, ${lng.toFixed(3)} · <a href="${osm}" target="_blank" rel="noopener">Open in OpenStreetMap ↗</a>`;
    const el = $("#map");
    if (typeof window.L === "undefined") {
      el.classList.add("map--placeholder");
      el.innerHTML = `<div><b>Map unavailable</b><span>The map service couldn't load. The trailhead is at ${lat.toFixed(4)}, ${lng.toFixed(4)}.</span></div>`;
      return;
    }
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([lat, lng], trail.days ? 10 : 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const icon = L.divIcon({ className: "map-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker([lat, lng], { icon, title: name }).addTo(map).bindPopup(`<b>Trailhead</b><br>${esc(name)}`);
    // Leaflet measures its box once; re-measure after layout and fonts settle.
    window.addEventListener("load", () => map.invalidateSize());
    if ("ResizeObserver" in window) new ResizeObserver(() => map.invalidateSize()).observe(el);
  }

  /* ------------------------------------------------------------------------
     Actions
     ------------------------------------------------------------------------ */
  function leave(href) {
    const curtain = $(".curtain");
    if (!animate) { window.location.href = href; return; }
    curtain.classList.add("is-on");
    gsap.timeline({ onComplete: () => { window.location.href = href; } })
      .fromTo(curtain, { display: "", yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: "expo.inOut" });
  }

  document.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]");
    if (action) {
      e.preventDefault();
      if (action.dataset.action === "restart") HF.Store.reset();
      else HF.Store.set({ step: HF.QUESTIONS.length }); // reopen on the review step, answers intact
      leave(action.getAttribute("href"));
      return;
    }
    const other = e.target.closest("[data-trail]");
    if (other) {
      HF.Store.set({ result: { ...result, selected: other.dataset.trail } });
      leave(window.location.pathname);
    }
  });

  /* ------------------------------------------------------------------------
     Motion: curtain, hero entrance, scroll reveals
     ------------------------------------------------------------------------ */
  function start() {
    window.scrollTo(0, 0);
    const curtain = $(".curtain");
    if (!animate) {
      root.classList.remove("js-curtain");
      curtain.remove();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    let lenis = null;
    if (typeof window.Lenis !== "undefined") {
      lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4) });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.4 });
      }));
    }

    const heroImg = $(".yh-hero__media img");
    const heroBits = document.querySelectorAll("[data-hero]");
    gsap.set(heroBits, { y: 34, opacity: 0 });
    gsap.set(heroImg, { scale: 1.18 });
    root.classList.remove("js-curtain");

    const ready = Promise.race([heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve(), new Promise((r) => setTimeout(r, 1800))]);
    ready.then(() => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .to(curtain, { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, 0)
        .set(curtain, { display: "none" })
        .to(heroImg, { scale: 1, duration: 2.6 }, 0.2)
        .to(heroBits, { y: 0, opacity: 1, duration: 1.4, stagger: 0.09, clearProps: "transform" }, 0.55);
    });

    // hero: photo drifts slower than the page
    gsap.to(".yh-hero__media", {
      yPercent: 18, ease: "none",
      scrollTrigger: { trigger: ".yh-hero", start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(".yh-hero__content", {
      yPercent: -12, opacity: 0.2, ease: "none",
      scrollTrigger: { trigger: ".yh-hero", start: "30% top", end: "bottom top", scrub: true },
    });
    gsap.to(".nav", {
      opacity: 0, y: -16, ease: "none",
      scrollTrigger: { trigger: ".yh-hero", start: "top top", end: "+=25%", scrub: true },
    });

    const fades = gsap.utils.toArray("[data-fade]");
    gsap.set(fades, { y: 40, opacity: 0 });
    ScrollTrigger.batch(fades, {
      start: "top 88%", once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.09, overwrite: true }),
    });

    const facts = gsap.utils.toArray(".facts__item");
    if (facts.length) {
      gsap.from(facts, {
        y: 24, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.06,
        scrollTrigger: { trigger: ".facts", start: "top 85%", once: true },
      });
    }

    gsap.utils.toArray(".gallery__item").forEach((fig) => {
      const img = fig.querySelector("img");
      gsap.fromTo(fig.querySelector(".gallery__frame"), { clipPath: "inset(12% 8% 12% 8% round 6px)" }, {
        clipPath: "inset(0% 0% 0% 0% round 6px)", duration: 1.4, ease: "expo.out",
        scrollTrigger: { trigger: fig, start: "top 85%", once: true },
      });
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, scale: 1.12, ease: "none",
        scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    const line = $(".profile__line");
    if (line) {
      gsap.fromTo(line, { strokeDashoffset: 1, strokeDasharray: 1 }, {
        strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut",
        scrollTrigger: { trigger: ".profile", start: "top 80%", once: true },
      });
      gsap.from(".profile__dot", {
        scale: 0, transformOrigin: "50% 50%", duration: 0.6, ease: "back.out(2)", stagger: 0.15, delay: 0.4,
        scrollTrigger: { trigger: ".profile", start: "top 80%", once: true },
      });
    }

    gsap.fromTo(".yh-cta__media", { yPercent: -8, scale: 1.08 }, {
      yPercent: 8, scale: 1, ease: "none",
      scrollTrigger: { trigger: ".yh-cta", start: "top bottom", end: "bottom top", scrub: true },
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }
})();
