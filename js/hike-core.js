/* ==========================================================================
   Travel — hike finder core: answer store, matching and explanations.
   Shared by the questionnaire (index.html) and the result page (your-hike/).
   ========================================================================== */
(() => {
  "use strict";

  const { TRAILS, QUESTIONS } = window.HIKE_DATA;
  const PHOTOS = window.HIKE_PHOTOS || {};

  /* ------------------------------------------------------------------------
     Store — answers survive navigation via sessionStorage
     ------------------------------------------------------------------------ */
  const KEY = "travel.hikeFinder.v1";
  const blank = () => ({ answers: {}, step: 0, result: null });
  let memory = blank(); // fallback when storage is blocked

  const Store = {
    get() {
      try {
        const raw = sessionStorage.getItem(KEY);
        return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
      } catch (e) {
        return memory;
      }
    },
    set(patch) {
      const next = { ...this.get(), ...patch };
      memory = next;
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* memory only */ }
      return next;
    },
    reset() {
      memory = blank();
      try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };

  /* ------------------------------------------------------------------------
     Lookups
     ------------------------------------------------------------------------ */
  const question = (key) => QUESTIONS.find((q) => q.key === key);
  const option = (key, value) => question(key).options.find((o) => String(o.value) === String(value));
  const trailById = (id) => TRAILS.find((t) => t.id === id);
  const photosOf = (trail) => PHOTOS[trail.id] || [];
  const isComplete = (answers) => QUESTIONS.every((q) => answers[q.key] !== undefined);

  /* ------------------------------------------------------------------------
     Matching — weighted score per answer, 0–1 each
     ------------------------------------------------------------------------ */
  const WEIGHTS = { landscape: 3, difficulty: 3, duration: 2.5, region: 2.5, weather: 1.5, goal: 2, group: 1.5 };
  const BUCKETS = question("duration").options.map((o) => o.range); // last one = multi-day

  function durationBuckets(trail) {
    if (trail.days) return [BUCKETS.length - 1];
    const [lo, hi] = trail.hours;
    const hits = [];
    BUCKETS.forEach((r, i) => {
      if (r && lo <= r[1] + 0.5 && hi >= r[0] - 0.5) hits.push(i);
    });
    return hits;
  }

  const SCORERS = {
    landscape: (t, v) => t.landscapes[v] || 0,
    difficulty: (t, v) => Math.max(0, 1 - Math.abs(t.difficulty - v) / 1.5),
    duration: (t, v) => {
      const gap = Math.min(...durationBuckets(t).map((b) => Math.abs(b - v)));
      return [1, 0.5, 0.15][gap] || 0;
    },
    region: (t, v) => {
      const inEurope = t.region !== "world";
      if (v === "europe") return inEurope ? 1 : 0;
      if (v === "worldwide") return inEurope ? 0.85 : 1;
      if (v === "surprise") return 1;
      return t.region === v ? 1 : inEurope ? 0.25 : 0;
    },
    weather: (t, v) => (v === "any" ? 1 : t.weather[v] || 0),
    goal: (t, v) => t.experiences[v] || 0,
    group: (t, v) => (t.groups.includes(v) ? 1 : 0),
  };

  function scoreTrail(trail, answers) {
    let sum = 0;
    let total = 0;
    const parts = {};
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      if (answers[key] === undefined) continue;
      parts[key] = SCORERS[key](trail, answers[key]);
      sum += parts[key] * weight;
      total += weight;
    }
    return { id: trail.id, score: total ? sum / total : 0, parts };
  }

  // "Surprise me" still ranks by the other answers; ties are broken by a hash
  // of the answers so the pick is stable for the same answers but varies between visitors.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function rank(answers) {
    const seed = JSON.stringify(answers);
    return TRAILS.map((t) => scoreTrail(t, answers))
      .sort((a, b) => b.score - a.score || hash(seed + a.id) - hash(seed + b.id))
      .map((r) => ({ ...r, percent: Math.round(r.score * 100) }));
  }

  /* ------------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------------ */
  const DIFF_LABELS = { 1: "Easy", 1.5: "Easy–moderate", 2: "Moderate", 2.5: "Moderate–challenging", 3: "Challenging", 3.5: "Challenging–extreme", 4: "Extreme" };
  const LANDSCAPE_NOUN = { mountains: "mountain", forests: "forest", lakes: "lake", coastal: "coastal", snowy: "glacier", valleys: "valley" };

  const difficultyLabel = (t) => DIFF_LABELS[t.difficulty];
  const durationText = (t) => (t.days ? `${t.days[0]}–${t.days[1]} days` : `${fmtHours(t.hours[0])}–${fmtHours(t.hours[1])} hours`);
  const fmtHours = (h) => String(h).replace(".5", "½");
  const km = (n) => `≈ ${n.toLocaleString("en-GB")} km`;
  const metres = (n) => `≈ ${n.toLocaleString("en-GB")} m`;
  const primaryLandscape = (t) => Object.entries(t.landscapes).sort((a, b) => b[1] - a[1])[0][0];
  // "Mid-June to …" reads as "mid-June to …" mid-sentence; month names keep their capital.
  const seasonInline = (t) => t.season.replace(/^(Mid|Late|Early|All)\b/, (m) => m.toLowerCase());
  const primaryWeather = (t) => Object.entries(t.weather).sort((a, b) => b[1] - a[1])[0][0];
  const WEATHER_TEXT = {
    sunny: "warm, dry and mostly sunny days",
    mild: "mild, comfortable hiking temperatures",
    cool: "cool, fresh and changeable weather",
    snow: "cold conditions, with snow and ice at altitude",
  };
  // e.g. "Mostly cool, fresh and changeable weather" — typical conditions in the hiking season
  const weatherText = (t) => {
    const w = WEATHER_TEXT[primaryWeather(t)];
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
  const strength = (s) => (s >= 0.8 ? "strong" : s >= 0.4 ? "good" : "partial");

  /* ------------------------------------------------------------------------
     Explanations — built from the visitor's answers and the trail's data
     ------------------------------------------------------------------------ */
  const GOAL_TEXT = {
    views: (t) => `The big moments are ${list(t.viewpoints)}.`,
    photo: (t) => `Bring a camera for ${list(t.viewpoints.slice(0, 2))}. ${t.highlights[0]}.`,
    peace: (t) => `${t.highlights[t.highlights.length - 1]} — and long stretches where the only sound is your own footsteps.`,
    challenge: (t) => `Expect ${km(t.distanceKm)} with ${metres(t.gainM)} of ascent. ${t.challenges[0]}.`,
    hidden: (t) => `${t.highlights[0]}, plus corners most visitors never reach, like ${t.viewpoints[t.viewpoints.length - 1]}.`,
    adventure: (t) => `${t.terrain} ${t.highlights[t.highlights.length - 1]}.`,
  };

  const GROUP_TEXT = {
    solo: (t) => (t.days ? "Staffed huts and well-trodden stages make it a good trek to walk alone." : "The route is well marked, so it works well on your own."),
    partner: (t) => `${t.highlights[0]} — a moment best shared.`,
    friends: (t) => `It has the rhythm a group enjoys: a real objective, then ${t.days ? "evenings together in huts and inns" : "time to celebrate afterwards"}.`,
    family: (t) => (t.difficulty <= 1.5 ? "The paths are gentle enough for children and anyone new to hiking." : `Best for families with older, active children — recommended level: ${lowerFirst(t.level)}.`),
  };

  function explain(trail, answers) {
    const { parts } = scoreTrail(trail, answers);
    const label = (key) => option(key, answers[key]).label;
    const phrase = (key) => option(key, answers[key]).phrase;
    const main = primaryLandscape(trail);
    const out = [];

    // landscape
    {
      const s = parts.landscape;
      const text = s >= 0.8
        ? trail.environment
        : s >= 0.4
          ? `${option("landscape", answers.landscape).label} are part of the scenery here, alongside ${option("landscape", main).phrase}. ${trail.environment}`
          : `This route is above all about ${option("landscape", main).phrase} rather than ${phrase("landscape")} — but it matched the rest of your answers better than any trail that has them.`;
      out.push({ key: "landscape", answer: label("landscape"), strength: strength(s), text });
    }

    // difficulty
    {
      const diff = trail.difficulty - answers.difficulty;
      const graded = difficultyLabel(trail).toLowerCase();
      const text = diff === 0
        ? `You asked for ${label("difficulty").toLowerCase()} hiking, and this route is graded ${graded}. ${trail.terrain}`
        : Math.abs(diff) <= 0.5
          ? `Graded ${graded} — close to the ${label("difficulty").toLowerCase()} level you asked for. ${trail.terrain}`
          : diff > 0
            ? `It's harder than you asked for (${graded}). ${trail.challenges[0]}, so plan for it.`
            : `It's gentler than you asked for (${graded}) — more time to enjoy the scenery. ${trail.terrain}`;
      out.push({ key: "difficulty", answer: label("difficulty"), strength: strength(parts.difficulty), text });
    }

    // duration
    {
      const s = parts.duration;
      const text = s === 1
        ? `It fits the time you have: ${durationText(trail)} for ${km(trail.distanceKm)}.`
        : `It takes ${durationText(trail)} for ${km(trail.distanceKm)} — ${trail.days ? "longer" : answers.duration === 4 ? "a day hike rather than a trek" : durationBuckets(trail)[0] > answers.duration ? "longer" : "shorter"} than you had in mind, but the closest fit to your other answers.`;
      out.push({ key: "duration", answer: label("duration"), strength: strength(s), text });
    }

    // region
    {
      const v = answers.region;
      const where = `${trail.destination}, ${trail.country}`;
      const text = v === "surprise"
        ? `You left the map to us. Based on your other answers, we picked ${where}.`
        : parts.region === 1
          ? `You wanted ${phrase("region")}: this trail is in ${where}.`
          : parts.region >= 0.8
            ? `You were open to anywhere in the world; this European trail, in ${where}, scored highest.`
            : `Nothing in ${phrase("region")} matched your other answers as closely, so we looked further afield: ${where}.`;
      out.push({ key: "region", answer: label("region"), strength: strength(parts.region), text });
    }

    // weather
    {
      const v = answers.weather;
      const s = parts.weather;
      const typical = WEATHER_TEXT[primaryWeather(trail)];
      const text = v === "any"
        ? `You're happy in any weather. In its season, ${seasonInline(trail)}, expect ${typical}.`
        : s >= 0.8
          ? `You prefer ${phrase("weather")}, and that's what this trail typically offers in its season, ${seasonInline(trail)}: ${typical}.`
          : s >= 0.4
            ? `${option("weather", v).label} days happen here, but in season expect mostly ${typical}.`
            : `In season this trail usually brings ${typical} rather than ${phrase("weather")} — but it matched your other answers better than any trail that does.`;
      out.push({ key: "weather", answer: label("weather"), strength: strength(s), text });
    }

    // goal
    {
      const s = parts.goal;
      const lead = s >= 0.8 ? "" : s >= 0.4 ? `It offers ${phrase("goal")} too. ` : `${label("goal")} isn't this trail's main strength, but there's still plenty: `;
      out.push({ key: "goal", answer: label("goal"), strength: strength(s), text: lead + GOAL_TEXT[answers.goal](trail) });
    }

    // group
    {
      const ok = parts.group === 1;
      const text = ok
        ? GROUP_TEXT[answers.group](trail)
        : `We'd normally recommend this route for ${list(trail.groups.map((g) => option("group", g).label.replace(/^With /, "").toLowerCase()))} hikers — recommended level: ${lowerFirst(trail.level)}.`;
      out.push({ key: "group", answer: label("group"), strength: ok ? "strong" : "partial", text });
    }

    return out;
  }

  // One-paragraph summary, e.g. "You selected challenging mountain trails with panoramic views. …"
  function summary(trail, answers) {
    const diff = option("difficulty", answers.difficulty).label.toLowerCase();
    const land = LANDSCAPE_NOUN[answers.landscape];
    const goal = option("goal", answers.goal).phrase;
    const weather = answers.weather && answers.weather !== "any" ? ` in ${option("weather", answers.weather).phrase}` : "";
    return `You selected ${diff} ${land} trails and ${goal}${weather}, hiking ${option("group", answers.group).phrase}. ` +
      `This route offers ${lowerFirst(trail.terrain.replace(/\.$/, ""))}, rewarded by ${list(trail.viewpoints.slice(0, 2))}.`;
  }

  function intro(trail, answers) {
    const article = /^[aeiou]/i.test(difficultyLabel(trail)) ? "An" : "A";
    return `${article} ${difficultyLabel(trail).toLowerCase()} ${trail.days ? "trek" : "hike"} of ${durationText(trail)} through ${option("landscape", primaryLandscape(trail)).phrase} — ` +
      `chosen for your love of ${option("goal", answers.goal).phrase}.`;
  }

  function gear(trail) {
    const items = ["Broken-in hiking boots or trail shoes", "Water (at least 1.5 litres) and snacks", "Rain jacket and a warm layer", "Small first-aid kit"];
    if (trail.difficulty >= 2.5 || trail.days) items.push("Trekking poles");
    if (trail.days) items.push("35–45 litre pack and hut or campsite bookings");
    if ((trail.landscapes.snowy || 0) >= 0.6 || trail.start.lat > 60) items.push("Sunglasses, gloves and a hat");
    return [...items, ...trail.gear];
  }

  function safety(trail) {
    const items = ["Check the mountain weather forecast the evening before and again in the morning"];
    if (trail.days || trail.difficulty >= 3) items.push("Leave your route and timing with someone at home, and set a turn-around time");
    if (trail.region === "world") items.push("Take out travel insurance that covers trekking at altitude");
    else items.push("In an emergency, call 112 (works throughout Europe)");
    return [...items, ...trail.safety];
  }

  window.HikeFinder = {
    TRAILS, QUESTIONS, Store, rank, explain, summary, intro, gear, safety,
    question, option, trailById, photosOf, isComplete,
    difficultyLabel, durationText, km, metres, primaryLandscape, weatherText,
  };
})();
