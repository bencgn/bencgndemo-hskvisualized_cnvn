const levelColors = {
  1: "var(--hsk1)",
  2: "var(--hsk2)",
  3: "var(--hsk3)",
  4: "var(--hsk4)",
  5: "var(--hsk5)",
  6: "var(--hsk6)",
};

const state = {
  levels: new Set([1, 2, 3, 4, 5, 6]),
  query: "",
  selectedButton: null,
  words: [],
  viewport: {
    scale: 0.58,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    isPanning: false,
    panActive: false,
    didPan: false,
  },
};

const chartMap = document.querySelector("#chartMap");
const chartContent = document.querySelector("#chartContent");
const chartScroll = document.querySelector(".chart-scroll");
const levelFilters = document.querySelector("#levelFilters");
const legend = document.querySelector("#legend");
const stats = document.querySelector("#stats");
const searchInput = document.querySelector("#searchInput");
const resetButton = document.querySelector("#resetButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");

const selectedHanzi = document.querySelector("#selectedHanzi");
const selectedMeta = document.querySelector("#selectedMeta");
const selectedPinyin = document.querySelector("#selectedPinyin");
const selectedVietnamese = document.querySelector("#selectedVietnamese");
const selectedEnglish = document.querySelector("#selectedEnglish");
const wordsByButton = new WeakMap();
let viewportFrame = null;
let useCrispZoom = false;
const activePointers = new Map();
const pinch = {
  distance: 0,
  scale: 1,
  contentX: 0,
  contentY: 0,
};

const joinMeanings = (items, fallback) => (items.length ? items.join("; ") : fallback);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const CRISP_ZOOM_IN = 1.35;
const CRISP_ZOOM_OUT = 1.18;

const searchableText = (word) =>
  [
    word.hanzi,
    word.traditional,
    word.pinyin,
    word.pinyinNumbered,
    ...word.vietnamese,
    ...word.english,
  ]
    .join(" ")
    .toLocaleLowerCase("vi");

function setSelected(word, button) {
  if (state.selectedButton) state.selectedButton.classList.remove("is-selected");
  state.selectedButton = button;
  button.classList.add("is-selected");

  selectedHanzi.textContent = word.hanzi;
  selectedMeta.textContent = `HSK ${word.level} · ${word.traditional || "simplified"} · ${
    word.partOfSpeech.join(", ") || "word"
  }`;
  selectedPinyin.textContent = word.pinyin || word.pinyinNumbered || "No pinyin";
  selectedVietnamese.textContent = joinMeanings(word.vietnamese, "Chưa có nghĩa tiếng Việt");
  selectedEnglish.textContent = joinMeanings(word.english, "No English source meaning");
}

function clampViewport() {
  const rect = chartScroll.getBoundingClientRect();
  const scaledWidth = chartMap.offsetWidth * state.viewport.scale;
  const scaledHeight = chartMap.offsetHeight * state.viewport.scale;
  const minX = Math.min(0, rect.width - scaledWidth);
  const maxX = Math.max(0, rect.width - scaledWidth);
  const minY = Math.min(0, rect.height - scaledHeight);
  const maxY = Math.max(0, rect.height - scaledHeight);

  state.viewport.x = clamp(state.viewport.x, minX, maxX);
  state.viewport.y = clamp(state.viewport.y, minY, maxY);
}

function applyViewport() {
  clampViewport();
  if (viewportFrame !== null) return;
  viewportFrame = requestAnimationFrame(() => {
    viewportFrame = null;
    if (state.viewport.scale >= CRISP_ZOOM_IN) useCrispZoom = true;
    if (state.viewport.scale <= CRISP_ZOOM_OUT) useCrispZoom = false;

    const cssZoom = useCrispZoom ? state.viewport.scale : 1;
    const transformScale = useCrispZoom ? 1 : state.viewport.scale;
    chartContent.style.setProperty("--css-zoom", cssZoom.toFixed(4));
    chartContent.style.setProperty("--transform-scale", transformScale.toFixed(4));
    chartMap.style.setProperty("--pan-x", `${state.viewport.x.toFixed(1)}px`);
    chartMap.style.setProperty("--pan-y", `${state.viewport.y.toFixed(1)}px`);
  });
}

function zoomAt(pointX, pointY, zoomFactor) {
  const beforeX = (pointX - state.viewport.x) / state.viewport.scale;
  const beforeY = (pointY - state.viewport.y) / state.viewport.scale;
  state.viewport.scale = clamp(state.viewport.scale * zoomFactor, 0.24, 5);
  state.viewport.x = pointX - beforeX * state.viewport.scale;
  state.viewport.y = pointY - beforeY * state.viewport.scale;
  applyViewport();
}

const getPointerItems = () => [...activePointers.values()];
const getPointerDistance = ([first, second]) => Math.hypot(first.x - second.x, first.y - second.y);
const getPointerCenter = ([first, second]) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

function viewportPointFromClient(clientX, clientY) {
  const rect = chartScroll.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function beginSinglePointerPan(pointer) {
  state.viewport.isPanning = true;
  state.viewport.panActive = false;
  state.viewport.startX = state.viewport.x;
  state.viewport.startY = state.viewport.y;
  state.viewport.pointerX = pointer.x;
  state.viewport.pointerY = pointer.y;
}

function beginPinchZoom() {
  const pointers = getPointerItems();
  const center = getPointerCenter(pointers);
  pinch.distance = getPointerDistance(pointers);
  pinch.scale = state.viewport.scale;
  pinch.contentX = (center.x - state.viewport.x) / state.viewport.scale;
  pinch.contentY = (center.y - state.viewport.y) / state.viewport.scale;
  state.viewport.panActive = true;
  state.viewport.didPan = true;
}

function fitChart() {
  const rect = chartScroll.getBoundingClientRect();
  const scaleX = (rect.width - 16) / chartMap.offsetWidth;
  const scaleY = (rect.height - 16) / chartMap.offsetHeight;
  state.viewport.scale = clamp(Math.max(scaleX, scaleY), 0.25, 1);
  state.viewport.x = 0;
  state.viewport.y = 0;
  applyViewport();
}

function renderLevelControls(levels) {
  levelFilters.innerHTML = "";
  legend.innerHTML = "";

  for (const level of levels) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-toggle";
    button.textContent = `HSK ${level.level}`;
    button.style.setProperty("--level-color", levelColors[level.level]);
    button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", () => {
      if (state.levels.has(level.level)) state.levels.delete(level.level);
      else state.levels.add(level.level);
      button.setAttribute("aria-pressed", String(state.levels.has(level.level)));
      applyFilters();
    });
    levelFilters.append(button);

    const item = document.createElement("span");
    item.className = "legend-item";
    item.style.setProperty("--level-color", levelColors[level.level]);
    item.innerHTML = `<span class="swatch"></span> HSK ${level.level}: ${level.count}`;
    legend.append(item);
  }
}

function renderChart(data) {
  chartContent.innerHTML = "";
  state.words = [];

  for (const level of data.levels) {
    const section = document.createElement("section");
    section.className = "level-section";
    section.dataset.level = level.level;
    section.setAttribute("aria-label", `${level.label}, ${level.count} words`);

    for (const word of level.words) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "word-tile";
      button.textContent = word.hanzi;
      button.title = `${word.hanzi} · ${word.pinyin} · ${joinMeanings(word.vietnamese, "")}`;
      button.dataset.level = word.level;
      button.dataset.search = searchableText(word);
      wordsByButton.set(button, word);
      button.addEventListener("click", () => setSelected(word, button));
      section.append(button);
      state.words.push({ word, button });
    }

    chartContent.append(section);
  }

  const firstWord = data.levels[0]?.words[0];
  const firstButton = chartContent.querySelector(".word-tile");
  if (firstWord && firstButton) setSelected(firstWord, firstButton);
  fitChart();
}

function applyFilters() {
  const query = state.query.trim().toLocaleLowerCase("vi");
  let visible = 0;

  for (const item of state.words) {
    const levelMatch = state.levels.has(item.word.level);
    const queryMatch = !query || item.button.dataset.search.includes(query);
    const show = levelMatch && queryMatch;
    item.button.classList.toggle("is-hidden", !show);
    if (show) visible += 1;
  }

  stats.textContent = `${visible.toLocaleString()} visible words · ${state.words.length.toLocaleString()} total`;
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  applyFilters();
});

resetButton.addEventListener("click", () => {
  state.query = "";
  searchInput.value = "";
  state.levels = new Set([1, 2, 3, 4, 5, 6]);
  document.querySelectorAll(".level-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", "true");
  });
  fitChart();
  applyFilters();
});

chartScroll.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const rect = chartScroll.getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
    const zoomFactor = Math.exp(-clamp(normalizedDelta, -90, 90) * 0.0018);
    zoomAt(pointX, pointY, zoomFactor);
  },
  { passive: false },
);

zoomInButton.addEventListener("click", () => {
  const rect = chartScroll.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, 1.45);
});

zoomOutButton.addEventListener("click", () => {
  const rect = chartScroll.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, 1 / 1.45);
});

chartScroll.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const point = viewportPointFromClient(event.clientX, event.clientY);
  activePointers.set(event.pointerId, point);
  chartScroll.classList.add("is-panning");
  chartScroll.setPointerCapture(event.pointerId);

  if (activePointers.size === 1) {
    state.viewport.didPan = false;
    beginSinglePointerPan(point);
  } else if (activePointers.size === 2) {
    beginPinchZoom();
  }
});

chartScroll.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, viewportPointFromClient(event.clientX, event.clientY));

  if (activePointers.size >= 2) {
    const pointers = getPointerItems();
    const center = getPointerCenter(pointers);
    const distance = getPointerDistance(pointers);
    if (pinch.distance <= 0) beginPinchZoom();
    state.viewport.scale = clamp(pinch.scale * (distance / pinch.distance), 0.24, 5);
    state.viewport.x = center.x - pinch.contentX * state.viewport.scale;
    state.viewport.y = center.y - pinch.contentY * state.viewport.scale;
    state.viewport.didPan = true;
    applyViewport();
    return;
  }

  if (!state.viewport.isPanning) return;
  const pointer = activePointers.get(event.pointerId);
  const dx = pointer.x - state.viewport.pointerX;
  const dy = pointer.y - state.viewport.pointerY;
  if (!state.viewport.panActive && Math.hypot(dx, dy) < 10) return;
  state.viewport.panActive = true;
  state.viewport.didPan = true;
  state.viewport.x = state.viewport.startX + dx;
  state.viewport.y = state.viewport.startY + dy;
  applyViewport();
});

function stopPan(event) {
  const wasTrackingPointer = activePointers.has(event.pointerId);
  const shouldSelectTile = wasTrackingPointer && activePointers.size === 1 && !state.viewport.didPan;
  activePointers.delete(event.pointerId);

  if (shouldSelectTile) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const button = target?.closest?.(".word-tile");
    const word = button ? wordsByButton.get(button) : null;
    if (word) setSelected(word, button);
  }

  if (chartScroll.hasPointerCapture(event.pointerId)) {
    chartScroll.releasePointerCapture(event.pointerId);
  }

  if (activePointers.size === 1) {
    beginSinglePointerPan(getPointerItems()[0]);
    state.viewport.didPan = true;
    return;
  }

  if (activePointers.size === 0) {
    state.viewport.isPanning = false;
    state.viewport.panActive = false;
    pinch.distance = 0;
    chartScroll.classList.remove("is-panning");
    setTimeout(() => {
      state.viewport.didPan = false;
    }, 0);
  }
}

chartScroll.addEventListener("pointerup", stopPan);
chartScroll.addEventListener("pointercancel", stopPan);

chartScroll.addEventListener(
  "click",
  (event) => {
    if (!state.viewport.didPan) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

window.addEventListener("resize", fitChart);

fetch("hsk-vocab.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load hsk-vocab.json: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    renderLevelControls(data.levels);
    renderChart(data);
    applyFilters();
  })
  .catch((error) => {
    stats.textContent = error.message;
  });
