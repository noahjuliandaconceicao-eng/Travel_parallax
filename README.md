# Travel_parallax

Guided hiking holidays landing page with a multilingual welcome loader,
a layered parallax hero
(sky → "TRAVEL" → mountain → interface), built with plain HTML/CSS/JS,
GSAP + ScrollTrigger and Lenis smooth scrolling (loaded from jsDelivr).

## Run

Any static server works, e.g.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

- `index.html` — markup for the hero and content sections
- `css/style.css` — layout, layering, responsive rules, reduced-motion rules
- `js/main.js` — sizes/positions the headline on the summit, intro, scroll choreography
- `assets/` — original photos; `assets/img/` — optimized WebP versions used by the site
- `assets/img/dest/` — destination photos (your own pics + Wikimedia Commons photos; credits are listed in the site footer)

### Trail finder (section 04) and `/your-hike`

- `js/hike-data.js` — the trail dataset (25 trails, 21 in Europe) and the seven questions (including weather); figures are approximate
- `js/hike-photos.js` — generated list of trail photos (Wikimedia Commons, with author and licence)
- `js/hike-core.js` — shared logic: answer store (sessionStorage), weighted matching, personalised explanations
- `js/hike-finder.js` — the step-by-step questionnaire on the homepage
- `your-hike/index.html`, `js/your-hike.js`, `css/your-hike.css` — the recommendation page (map: Leaflet + OpenStreetMap)
- `assets/img/hikes/` — trail photos (`*-2000.webp` heroes, `*-640.webp` questionnaire cards)

Visiting `/your-hike` without answering the questions shows an empty state with a link back to the questionnaire.

### Explore by destination (world map)

- `assets/world-map.svg` — Natural Earth country outlines (via world-atlas 50m), pre-projected with Natural Earth I
- `js/destinations-data.js` — the 19 mapped destinations (coordinates, continent, description, photo) and continent views
- `js/destination-photos.js` + `assets/img/destinations/` — destination photos from Wikimedia Commons
- `js/world-map.js` — loads the map, places the markers with the same projection, tooltips, info panel and continent filters;
  "Explore destination" opens the trail finder with the matching region pre-selected
