const state = {
  month: 4,
  activePlants: new Set(),
  selectedId: null,
  query: ""
};

const seasons = {
  12: "冬季",
  1: "冬季",
  2: "冬季",
  3: "春季",
  4: "春季",
  5: "春季",
  6: "夏季",
  7: "夏季",
  8: "夏季",
  9: "秋季",
  10: "秋季",
  11: "秋季"
};

const plantFilter = document.querySelector("#plantFilter");
const spotList = document.querySelector("#spotList");
const detailPanel = document.querySelector("#detailPanel");
const monthRange = document.querySelector("#monthRange");
const monthLabel = document.querySelector("#monthLabel");
const seasonLabel = document.querySelector("#seasonLabel");
const topbarMonth = document.querySelector("#topbarMonth");
const topbarSeason = document.querySelector("#topbarSeason");
const searchInput = document.querySelector("#searchInput");
const searchClear = document.querySelector("#searchClear");
const resetFilters = document.querySelector("#resetFilters");
const bloomCalendar = document.querySelector("#bloomCalendar");
const fitActive = document.querySelector("#fitActive");
const fitAll = document.querySelector("#fitAll");
const depthToggle = document.querySelector("#depthToggle");
const windLayerToggle = document.querySelector("#windLayerToggle");
const heatLayerToggle = document.querySelector("#heatLayerToggle");
const structureLayerToggle = document.querySelector("#structureLayerToggle");
const panelToggle = document.querySelector("#panelToggle");
const panelToggleText = document.querySelector(".panel-toggle-text");
const controlPanel = document.querySelector("#controlPanel");
const panelControlDock = document.querySelector(".panel-control-dock");
const panelSections = Array.from(document.querySelectorAll(".control-panel .panel-section"));
const detailSection = document.querySelector("#detailSection");
const mapStage = document.querySelector("#mapStage");
const seasonTimeline = document.querySelector("#seasonTimeline");
const pollenCanvas = document.querySelector("#pollenCanvas");
const pollenToggle = document.querySelector("#pollenToggle");
const pollenDensity = document.querySelector("#pollenDensity");
const windArrow = document.querySelector("#windArrow");
const windBrief = document.querySelector("#windBrief");
const windDirectionLabel = document.querySelector("#windDirectionLabel");
const windSpeedLabel = document.querySelector("#windSpeedLabel");
const pollenSourceLabel = document.querySelector("#pollenSourceLabel");
const monthNumbers = Array.from({ length: 12 }, (_, index) => index + 1);

let map;
let mapLoaded = false;
let pollenContext;
let animationFrameId;
let lastFrameTime = 0;
let structureLayerIds = [];
let structureMarkers = [];
let pollenSyncReferencePoint = null;
let pollenSyncZoom = null;
let suppressNextPanelDismiss = false;
const markerById = new Map();
const beijingCenter = { lat: 39.9042, lng: 116.4074 };
const pollenState = {
  enabled: true,
  heatEnabled: true,
  structureEnabled: false,
  windEnabled: true,
  particles: [],
  sources: [],
  density: 48,
  windLines: []
};
let depthEnabled = false;
let panelVisible = !document.body.classList.contains("panel-collapsed");
let hoverPopup = null;

function keepPanelOpenForCurrentClick() {
  suppressNextPanelDismiss = true;
  requestAnimationFrame(() => {
    suppressNextPanelDismiss = false;
  });
}

function setPanelVisible(visible) {
  panelVisible = visible;
  document.body.classList.toggle("panel-collapsed", !panelVisible);
  controlPanel.setAttribute("aria-hidden", String(!panelVisible));
  panelToggle.setAttribute("aria-expanded", String(panelVisible));
  panelToggle.setAttribute("aria-label", panelVisible ? "收起控制面板" : "展开控制面板");
  if (panelToggleText) {
    panelToggleText.textContent = panelVisible ? "收起" : "控制";
  }
  setTimeout(() => {
    if (!map) return;
    map.resize();
    resizePollenCanvas();
    updatePollenSources();
  }, 260);
}

function setDepthEnabled(enabled) {
  depthEnabled = enabled;
  mapStage.classList.toggle("is-depth", depthEnabled);
  depthToggle.classList.toggle("is-active", depthEnabled);
  depthToggle.setAttribute("aria-pressed", String(depthEnabled));
  if (map && mapLoaded) {
    map.flyTo({
      pitch: enabled ? 48 : 0,
      bearing: enabled ? 315 : 0,
      duration: 800
    });
    setTimeout(() => {
      resizePollenCanvas();
      updatePollenSources();
    }, 400);
  }
}

function focusPanelOnDetails() {
  panelSections.forEach((section) => {
    section.open = section === detailSection;
  });
  requestAnimationFrame(() => {
    detailSection?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

const plantNames = [...new Set(PLANT_SPOTS.map((spot) => spot.plant))].sort((a, b) => {
  return a.localeCompare(b, "zh-CN");
});

function getMapLatLng(spot) {
  return [spot.lng, spot.lat];
}

function getStatus(spot, month = state.month) {
  if (!spot.months.includes(month)) {
    return { key: "off", label: "非花期", isActive: false, isPeak: false };
  }

  if (spot.peak === month) {
    return { key: "peak", label: "盛花", isActive: true, isPeak: true };
  }

  return { key: "bloom", label: "花期", isActive: true, isPeak: false };
}

function getStatusThemeColor(status) {
  if (status.key === "peak") return "#c24170";
  if (status.key === "bloom") return "#0f766e";
  return "#94a3b8";
}

function isFilteredByPlant(spot) {
  return state.activePlants.size === 0 || state.activePlants.has(spot.plant);
}

function matchesQuery(spot) {
  if (!state.query) return true;
  const haystack = [spot.place, spot.plant, spot.district, spot.bloom, spot.description].join(" ");
  return haystack.toLowerCase().includes(state.query.toLowerCase());
}

function getVisibleSpots() {
  return PLANT_SPOTS.filter((spot) => isFilteredByPlant(spot) && matchesQuery(spot));
}

function getRecommendedSpots(spots = getVisibleSpots()) {
  return spots
    .filter((spot) => getStatus(spot).isActive)
    .sort((a, b) => {
      const statusA = getStatus(a);
      const statusB = getStatus(b);
      if (statusA.isPeak !== statusB.isPeak) return statusA.isPeak ? -1 : 1;
      return (b.area || 0) - (a.area || 0);
    });
}

function getVisibleSelectedSpot(visibleSpots = getVisibleSpots()) {
  return visibleSpots.find((spot) => spot.id === state.selectedId) || null;
}

function getFocusPlant(visibleSpots = getVisibleSpots()) {
  const selected = getVisibleSelectedSpot(visibleSpots);
  if (selected) return selected.plant;
  if (state.activePlants.size === 1) return [...state.activePlants][0];
  return null;
}

function getNarrativeSpots(visibleSpots = getVisibleSpots(), focusPlant = getFocusPlant(visibleSpots)) {
  return focusPlant ? visibleSpots.filter((spot) => spot.plant === focusPlant) : visibleSpots;
}

function getPlantProfile(plant, sourceSpots = PLANT_SPOTS) {
  const plantSpots = sourceSpots.filter((spot) => spot.plant === plant);
  const activeMonths = monthNumbers.filter((month) => plantSpots.some((spot) => spot.months.includes(month)));
  const peakMonths = monthNumbers.filter((month) => plantSpots.some((spot) => spot.peak === month));
  const currentSpots = plantSpots.filter((spot) => spot.months.includes(state.month));
  return {
    spots: plantSpots,
    activeMonths,
    peakMonths,
    currentSpots,
    districtCount: new Set(plantSpots.map((spot) => spot.district)).size
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function getWind() {
  return MONTHLY_WIND_MODEL[state.month] || MONTHLY_WIND_MODEL[4];
}

function getWindVector() {
  const wind = getWind();
  const toDirection = (wind.direction + 180) % 360;
  const radians = (toDirection * Math.PI) / 180;
  return {
    x: Math.sin(radians) * wind.speed,
    y: -Math.cos(radians) * wind.speed,
    wind
  };
}

function getMarkerClass(spot, focusPlant = null) {
  const status = getStatus(spot);
  const classes = ["plant-map-marker"];
  if (status.isActive && !status.isPeak) classes.push("is-bloom");
  if (status.isPeak) classes.push("is-peak");
  if (!status.isActive) classes.push("is-dim");
  if (focusPlant) {
    if (spot.plant === focusPlant) {
      classes.push("is-focus-plant");
    } else {
      classes.push("is-context");
    }
  }
  if (state.selectedId === spot.id) classes.push("is-selected");
  if (!isFilteredByPlant(spot) || !matchesQuery(spot)) classes.push("is-hidden");
  return classes.join(" ");
}

function toMapLatLng(lat, lng) {
  return [lng, lat];
}

function ellipseLatLngs(center, radiusXKm, radiusYKm, points = 132, rotationDeg = 0) {
  const latLngs = [];
  const rotation = (rotationDeg * Math.PI) / 180;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const x = Math.cos(angle) * radiusXKm;
    const y = Math.sin(angle) * radiusYKm;
    const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
    const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
    const lat = center.lat + rotatedY / 111;
    const lng = center.lng + rotatedX / (111 * cosLat);
    latLngs.push(toMapLatLng(lat, lng));
  }

  return latLngs;
}

function pathLatLngs(points) {
  return points.map(([lat, lng]) => toMapLatLng(lat, lng));
}

function ellToLngLat(center, radiusXKm, radiusYKm, points, rotationDeg) {
  return ellipseLatLngs(center, radiusXKm, radiusYKm, points, rotationDeg);
}

function pathToLngLat(points) {
  return pathLatLngs(points);
}

function toLngLat(lat, lng) {
  return [lng, lat];
}

function addStructureLayer(id, geoJson, type, paint) {
  if (!map || !mapLoaded) return;
  const sourceId = `struct-${id}`;
  map.addSource(sourceId, { type: "geojson", data: geoJson });
  map.addLayer({
    id: sourceId,
    type,
    source: sourceId,
    ...(type === "line" ? {
      paint: {
        "line-color": paint.color || "#000",
        "line-width": paint.weight || 1,
        "line-opacity": paint.opacity ?? 1,
        "line-dasharray": paint.dashArray
      }
    } : {}),
    ...(type === "fill" ? {
      paint: {
        "fill-color": paint.color || "#000",
        "fill-opacity": paint.fillOpacity ?? 0.1
      }
    } : {})
  });
  structureLayerIds.push(sourceId);
}

function initStructureLayer() {
  if (!map || !window.maplibregl) return;
  const cc = beijingCenter;

  addStructureLayer("mountain", {
    type: "Feature", geometry: { type: "Polygon", coordinates: [pathToLngLat([
      [40.95, 115.18], [40.78, 115.86], [40.52, 116.23],
      [40.12, 116.08], [39.78, 115.76], [39.58, 115.28],
      [39.86, 115.06], [40.36, 115.02]
    ])] }
  }, "fill", { color: "#475467", fillOpacity: 0.18 });

  addStructureLayer("ring-5", {
    type: "Feature", geometry: { type: "LineString", coordinates: ellToLngLat(cc, 24, 20, 160, -6) }
  }, "line", { color: "#475467", weight: 1.1, opacity: 0.38, dashArray: [5, 8] });

  addStructureLayer("ring-6", {
    type: "Feature", geometry: { type: "LineString", coordinates: ellToLngLat(cc, 42, 34, 180, -4) }
  }, "line", { color: "#475467", weight: 1, opacity: 0.28, dashArray: [3, 12] });

  addStructureLayer("core-fill", {
    type: "Feature", geometry: { type: "Polygon", coordinates: [ellToLngLat(cc, 7.2, 6.2, 104, -8)] }
  }, "fill", { color: "#0f766e", fillOpacity: 0.045 });

  addStructureLayer("core-line", {
    type: "Feature", geometry: { type: "LineString", coordinates: ellToLngLat(cc, 7.2, 6.2, 104, -8) }
  }, "line", { color: "#0f766e", weight: 1.2, opacity: 0.36 });

  addStructureLayer("water-1", {
    type: "Feature", geometry: { type: "LineString", coordinates: pathToLngLat([
      [40.22, 115.88], [40.06, 116.02], [39.9, 116.16],
      [39.72, 116.23], [39.54, 116.4]
    ]) }
  }, "line", { color: "#2563eb", weight: 1.2, opacity: 0.3 });

  addStructureLayer("water-2", {
    type: "Feature", geometry: { type: "LineString", coordinates: pathToLngLat([
      [40.33, 116.25], [40.18, 116.42], [40.05, 116.58],
      [39.86, 116.69], [39.66, 116.76]
    ]) }
  }, "line", { color: "#2563eb", weight: 1.2, opacity: 0.28 });

  addStructureLayer("axis", {
    type: "Feature", geometry: { type: "LineString", coordinates: pathToLngLat([
      [40.46, 116.0], [40.18, 116.22], [39.9, 116.45],
      [39.62, 116.76], [39.38, 117.05]
    ]) }
  }, "line", { color: "#0f766e", weight: 1, opacity: 0.2, dashArray: [10, 12] });

  // Labels
  const labels = [
    ["五环", 39.925, 116.705, "is-ring"],
    ["六环", 39.92, 116.945, "is-ring"],
    ["核心城区", 39.904, 116.406, "is-core"],
    ["西山-燕山", 40.18, 115.55, "is-terrain"],
    ["平原廊道", 39.58, 116.78, "is-axis"],
    ["永定河", 39.78, 116.18, "is-water"],
    ["温榆-潮白", 40.08, 116.58, "is-water"]
  ];

  labels.forEach(([text, lat, lng, cls]) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.className = `structure-label ${cls}`.trim();
    const marker = new maplibregl.Marker({ element: el, interactive: false })
      .setLngLat(toLngLat(lat, lng))
      .addTo(map);
    structureMarkers.push(marker);
  });
}

function initMap() {
  if (!window.maplibregl) {
    document.querySelector("#realMap").innerHTML = `<p class="map-fallback">地图资源加载失败，请检查网络后刷新。</p>`;
    return;
  }

  map = new maplibregl.Map({
    container: "realMap",
    style: getMapStyle(),
    center: [116.42, 39.93],
    zoom: 11.2,
    pitch: 48,
    bearing: 315,
    minZoom: 9.5,
    maxZoom: 14.5,
    maxBounds: [[115.0, 39.0], [117.5, 41.0]],
    attributionControl: true
  });

map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  // 提前创建标记，不等地图瓦片加载完成
  addPlantMarkers();

  map.on("load", () => {
    // Add custom attribution
    document.querySelector(".maplibregl-ctrl-attrib")?.insertAdjacentHTML("beforeend",
      ' · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>');
    mapLoaded = true;
    depthEnabled = true;
    mapStage.classList.add("is-depth");
    depthToggle.classList.add("is-active");
    depthToggle.setAttribute("aria-pressed", "true");
    initStructureLayer();
    structureLayerIds.forEach((id) => {
      map.setLayoutProperty(id, "visibility", "none");
    });
    structureMarkers.forEach((m) => {
      m.getElement().style.display = "none";
    });
    initPollenCanvas();
    primePollenMapSync();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        map.resize();
        resizePollenCanvas();
        updatePollenSources();
        primePollenMapSync();
      });
    });
    // Start intro animation after initialization
    setTimeout(() => playIntroAnimation(), 1200);
  });

  // Fallback: if load doesn't fire within 8s, force init
  const loadTimer = setTimeout(() => {
    if (!mapLoaded) {
      map.fire("load");
    }
  }, 8000);

  map.on("move", () => {
    if (!mapLoaded) return;
    syncPollenLayerToMap();
    updatePollenSources();
  });
  map.on("zoomstart", () => {
    pollenState.particles = [];
  });
  map.on("zoomend", () => {
    if (!mapLoaded) return;
    primePollenMapSync();
    updatePollenSources();
  });
  map.on("resize", () => {
    if (!mapLoaded) return;
    resizePollenCanvas();
    updatePollenSources();
    primePollenMapSync();
  });
}

function getMapStyle() {
  return {
    version: 8,
    sources: {
      ne2_shaded: {
        maxzoom: 6, tileSize: 256,
        tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
        type: "raster"
      },
      openmaptiles: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet"
      }
    },
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#eeebe6" } },
      { id: "ne2_shaded", type: "raster", source: "ne2_shaded", maxzoom: 7,
        paint: { "raster-opacity": ["interpolate",["exponential",1.5],["zoom"],0,0.4,6,0.06] } },

      { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
        paint: { "fill-color": "#ccd5c0", "fill-opacity": 0.55 } },
      { id: "landuse_residential", type: "fill", source: "openmaptiles", "source-layer": "landuse",
        maxzoom: 12,
        filter: ["==",["get","class"],"residential"],
        paint: { "fill-color": ["interpolate",["linear"],["zoom"],9,"hsla(40,5%,85%,0.5)",12,"hsla(40,5%,88%,0.3)"] } },
      { id: "landcover_wood", type: "fill", source: "openmaptiles", "source-layer": "landcover",
        filter: ["==",["get","class"],"wood"],
        paint: { "fill-antialias": false, "fill-color": "#b8c8ae", "fill-opacity": 0.3 } },
      { id: "landcover_grass", type: "fill", source: "openmaptiles", "source-layer": "landcover",
        filter: ["==",["get","class"],"grass"],
        paint: { "fill-antialias": false, "fill-color": "#c4d0b8", "fill-opacity": 0.2 } },
      { id: "landcover_wetland", type: "fill", source: "openmaptiles", "source-layer": "landcover",
        minzoom: 12, filter: ["==",["get","class"],"wetland"],
        paint: { "fill-antialias": true, "fill-opacity": 0.5, "fill-pattern": "wetland_bg_11" } },
      { id: "landuse_cemetery", type: "fill", source: "openmaptiles", "source-layer": "landuse",
        filter: ["==",["get","class"],"cemetery"],
        paint: { "fill-color": "#ccd5c0" } },
      { id: "landuse_school", type: "fill", source: "openmaptiles", "source-layer": "landuse",
        filter: ["==",["get","class"],"school"],
        paint: { "fill-color": "#d8d8ce" } },

      { id: "waterway_river", type: "line", source: "openmaptiles", "source-layer": "waterway",
        filter: ["all",["==",["get","class"],"river"],["!=",["get","brunnel"],"tunnel"]],
        layout: { "line-cap": "round" },
        paint: { "line-color": "#b0c4d4", "line-width": ["interpolate",["exponential",1.2],["zoom"],11,0.5,20,6] } },
      { id: "waterway_other", type: "line", source: "openmaptiles", "source-layer": "waterway",
        filter: ["all",["!=",["get","class"],"river"],["!=",["get","brunnel"],"tunnel"]],
        layout: { "line-cap": "round" },
        paint: { "line-color": "#b0c4d4", "line-width": ["interpolate",["exponential",1.3],["zoom"],13,0.5,20,6] } },
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
        filter: ["!=",["get","brunnel"],"tunnel"],
        paint: { "fill-color": "#b8ccda" } },

      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building",
        minzoom: 13, maxzoom: 14,
        paint: { "fill-color": "#d4d0ca", "fill-outline-color": ["interpolate",["linear"],["zoom"],13,"hsla(35,3%,79%,0.2)",14,"hsl(35,3%,79%)"] } },
      { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-base": ["get","render_min_height"],
          "fill-extrusion-color": "#d4d0ca",
          "fill-extrusion-height": ["get","render_height"],
          "fill-extrusion-opacity": 0.55
        } },

      { id: "road_major_casing", type: "line", source: "openmaptiles", "source-layer": "transportation",
        minzoom: 8,
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["motorway","trunk","primary"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#c8c0b8", "line-width": ["interpolate",["exponential",1.2],["zoom"],5,0.4,6,0.7,7,1.75,20,18] } },
      { id: "road_major", type: "line", source: "openmaptiles", "source-layer": "transportation",
        minzoom: 5,
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["motorway","trunk","primary"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#ddd6cc", "line-width": ["interpolate",["exponential",1.2],["zoom"],5,0,7,1,20,18] } },

      { id: "road_medium_casing", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["secondary","tertiary"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#c8c0b8", "line-width": ["interpolate",["exponential",1.2],["zoom"],8,1.5,20,15] } },
      { id: "road_medium", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["secondary","tertiary"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#e0d8ce", "line-width": ["interpolate",["exponential",1.2],["zoom"],6.5,0,8,0.5,20,13] } },

      { id: "road_minor_casing", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["minor","street"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#c8c4be", "line-opacity": ["interpolate",["linear"],["zoom"],12,0,12.5,1], "line-width": ["interpolate",["exponential",1.2],["zoom"],12,0.5,13,1,14,4,20,18] } },
      { id: "road_minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["minor","street"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#ece6e0", "line-width": ["interpolate",["exponential",1.2],["zoom"],13.5,0,14,2.5,20,18] } },

      { id: "road_service", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["match",["get","class"],["service","track"],true,false]],
        layout: { "line-join": "round" },
        paint: { "line-color": "#ece6e0", "line-width": ["interpolate",["exponential",1.2],["zoom"],15.5,0,16,2,20,7.5] } },

      { id: "road_major_rail", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["==",["get","class"],"rail"]],
        paint: { "line-color": "#c0bcb6", "line-width": ["interpolate",["exponential",1.4],["zoom"],14,0.4,15,0.75,20,2] } },

      { id: "boundary_3", type: "line", source: "openmaptiles", "source-layer": "boundary",
        minzoom: 5,
        filter: ["all",[">=",["get","admin_level"],3],["<=",["get","admin_level"],6],["!=",["get","maritime"],1],["!=",["get","disputed"],1],["!",["has","claimed_by"]]],
        paint: { "line-color": "#c8c4be", "line-dasharray": [1,1], "line-width": ["interpolate",["linear",1],["zoom"],7,1,11,2] } },
      { id: "boundary_2", type: "line", source: "openmaptiles", "source-layer": "boundary",
        filter: ["all",["==",["get","admin_level"],2],["!=",["get","maritime"],1],["!=",["get","disputed"],1],["!",["has","claimed_by"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b0aca6", "line-width": ["interpolate",["linear"],["zoom"],3,1,5,1.2,12,3] } },

      { id: "water_name_line_label", type: "symbol", source: "openmaptiles", "source-layer":"water_name",
        minzoom: 10,
        filter: ["match",["geometry-type"],["LineString","MultiLineString"],true,false],
        layout: { "symbol-placement": "line", "symbol-spacing": 350,
          "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Italic"], "text-letter-spacing": 0.2, "text-max-width": 5, "text-size": 12 },
        paint: { "text-color": "#7a9499", "text-halo-color": "rgba(255,255,255,0.6)", "text-halo-width": 1.2 } },
      { id: "water_name_point_label", type: "symbol", source: "openmaptiles", "source-layer":"water_name",
        filter: ["match",["geometry-type"],["MultiPoint","Point"],true,false],
        layout: { "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Italic"], "text-max-width": 5,
          "text-size": ["interpolate",["linear"],["zoom"],0,10,8,14] },
        paint: { "text-color": "#7a9499", "text-halo-color": "rgba(255,255,255,0.6)", "text-halo-width": 1.2 } },

      { id: "highway-name-major", type: "symbol", source: "openmaptiles", "source-layer":"transportation_name",
        minzoom: 12,
        filter: ["match",["get","class"],["primary","secondary","tertiary","trunk"],true,false],
        layout: { "symbol-placement": "line",
          "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Regular"], "text-rotation-alignment": "map",
          "text-size": ["interpolate",["linear"],["zoom"],13,12,14,13] },
        paint: { "text-color": "#88827a", "text-halo-blur": 0.5, "text-halo-color": "#eeebe6", "text-halo-width": 0.8 } },

      { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place",
        minzoom: 6,
        filter: ["all",["==",["get","class"],"city"]],
        layout: { "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Regular"], "text-max-width": 8,
          "text-size": ["interpolate",["exponential",1.2],["zoom"],4,11,7,13,11,16] },
        paint: { "text-color": "#605c56", "text-halo-blur": 1, "text-halo-color": "#eeebe6", "text-halo-width": 1 } },
      { id: "label_town", type: "symbol", source: "openmaptiles", "source-layer": "place",
        minzoom: 8,
        filter: ["==",["get","class"],"town"],
        layout: { "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Regular"], "text-max-width": 8,
          "text-size": ["interpolate",["exponential",1.2],["zoom"],7,12,11,14] },
        paint: { "text-color": "#605c56", "text-halo-blur": 1, "text-halo-color": "#eeebe6", "text-halo-width": 1 } },
      { id: "label_village", type: "symbol", source: "openmaptiles", "source-layer": "place",
        minzoom: 10,
        filter: ["==",["get","class"],"village"],
        layout: { "text-field": ["case",["has","name:nonlatin"],["get","name:nonlatin"],["get","name"]],
          "text-font": ["Noto Sans Regular"], "text-max-width": 8,
          "text-size": ["interpolate",["exponential",1.2],["zoom"],7,10,11,12] },
        paint: { "text-color": "#706c66", "text-halo-blur": 1, "text-halo-color": "#eeebe6", "text-halo-width": 1 } }
    ]
  };
}

function addPlantMarkers() {
  PLANT_SPOTS.forEach((spot) => {
    const pos = getMapLatLng(spot);
    const color = PLANT_COLORS[spot.plant] || "#557c6f";
    const el = document.createElement("div");
    el.innerHTML = `<span class="${getMarkerClass(spot)}" style="--marker-color:${color}"></span>`;
    el.className = "plant-icon-shell";

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(pos)
      .addTo(map);

    el.addEventListener("click", () => {
      keepPanelOpenForCurrentClick();
      state.selectedId = spot.id;
      setPanelVisible(true);
      map.flyTo({ center: pos, zoom: 11, duration: 800 });
      render();
      focusPanelOnDetails();
    });

    el.addEventListener("mouseenter", () => {
      if (state.selectedId === spot.id) return;
      if (!hoverPopup) {
        hoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "200px",
          className: "marker-hover-popup"
        });
      }
      hoverPopup.setLngLat(pos)
        .setHTML(`${spot.place} · <strong>${spot.plant}</strong>`)
        .addTo(map);
    });

    el.addEventListener("mouseleave", () => {
      if (hoverPopup) hoverPopup.remove();
    });

    markerById.set(spot.id, marker);
  });
}

function fitMapToSpots(spots) {
  if (!map || spots.length === 0 || !window.maplibregl) return;
  const bounds = spots.reduce((acc, spot) => {
    return acc.extend(getMapLatLng(spot));
  }, new maplibregl.LngLatBounds(getMapLatLng(spots[0])));
  map.fitBounds(bounds, { padding: 44, maxZoom: 10 });
}

function initPollenCanvas() {
  pollenContext = pollenCanvas.getContext("2d");
  resizePollenCanvas();
  startPollenAnimation();
}

function resizePollenCanvas() {
  if (!pollenCanvas) return;
  const rect = pollenCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  pollenCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  pollenCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  pollenCanvas.style.width = `${rect.width}px`;
  pollenCanvas.style.height = `${rect.height}px`;
  if (pollenContext) {
    pollenContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resetWindLines(rect.width, rect.height);
}

function getPollenSyncReference() {
  return [116.4074, 39.9042];
}

function primePollenMapSync() {
  if (!map || !window.maplibregl) return;
  const point = map.project(getPollenSyncReference());
  pollenSyncReferencePoint = { x: point.x, y: point.y };
  pollenSyncZoom = map.getZoom();
}

function syncPollenLayerToMap() {
  if (!map || !pollenSyncReferencePoint) {
    primePollenMapSync();
    return;
  }

  const currentZoom = map.getZoom();
  const next = map.project(getPollenSyncReference());
  const nextReferencePoint = { x: next.x, y: next.y };

  if (currentZoom !== pollenSyncZoom) {
    pollenState.particles = [];
    pollenSyncReferencePoint = nextReferencePoint;
    pollenSyncZoom = currentZoom;
    return;
  }

  const dx = nextReferencePoint.x - pollenSyncReferencePoint.x;
  const dy = nextReferencePoint.y - pollenSyncReferencePoint.y;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    pollenState.particles.forEach((particle) => {
      particle.x += dx;
      particle.y += dy;
    });
  }

  pollenSyncReferencePoint = nextReferencePoint;
  pollenSyncZoom = currentZoom;
}

function resetWindLines(width, height) {
  const lineCount = Math.max(18, Math.floor((width * height) / 22000));
  pollenState.windLines = Array.from({ length: lineCount }, (_, index) => createWindLine(width, height, index / lineCount));
}

function createWindLine(width, height, seed = Math.random()) {
  const depth = 0.12 + Math.random() * 0.88;
  return {
    x: width * ((seed * 1.91 + Math.random() * 0.35) % 1),
    y: height * ((seed * 2.37 + Math.random() * 0.45) % 1),
    depth,
    phase: Math.random() * Math.PI * 2,
    length: 46 + depth * 112 + Math.random() * 42,
    curve: 2.8 + depth * 7 + Math.random() * 5,
    speed: 0.42 + depth * 0.95 + Math.random() * 0.28,
    alpha: 0.045 + depth * 0.18 + Math.random() * 0.055,
    beadOffset: Math.random()
  };
}

function getVisualDepth(y, height) {
  const verticalDepth = height > 0 ? Math.max(0, Math.min(1, y / height)) : 0.5;
  const depth = 0.16 + verticalDepth * 0.58 + Math.random() * 0.26;
  return Math.max(0.12, Math.min(1, depth));
}

function getPollenIntensity(spot) {
  const status = getStatus(spot);
  if (!status.isActive) return 0;
  const plantFactor = POLLEN_PROFILE[spot.plant] ?? 0.45;
  const statusFactor = status.isPeak ? 1 : 0.52;
  const areaFactor = spot.area ? Math.min(1.8, Math.log10(spot.area + 10) / 5) : 0.65;
  return plantFactor * statusFactor * areaFactor;
}

function updatePollenSources(sourceSpots = getNarrativeSpots()) {
  if (!map) return;
  pollenState.sources = sourceSpots
    .map((spot) => {
      const intensity = getPollenIntensity(spot);
      if (intensity <= 0) return null;
      const point = map.project(getMapLatLng(spot));
      const rgb = hexToRgb(PLANT_COLORS[spot.plant] || "#8b949e");
      return {
        spot,
        x: point.x,
        y: point.y,
        intensity,
        rgb
      };
    })
    .filter(Boolean);
  pollenSourceLabel.textContent = pollenState.sources.length;
}

function pickPollenSource() {
  const total = pollenState.sources.reduce((sum, source) => sum + source.intensity, 0);
  if (!total) return null;
  let cursor = Math.random() * total;
  for (const source of pollenState.sources) {
    cursor -= source.intensity;
    if (cursor <= 0) return source;
  }
  return pollenState.sources[pollenState.sources.length - 1];
}

function spawnParticle(rect) {
  const source = pickPollenSource();
  if (!source) return;
  const jitter = 16 + Math.random() * 22;
  const angle = Math.random() * Math.PI * 2;
  const windVector = getWindVector();
  const depth = getVisualDepth(source.y, rect.height);
  const speedScale = 0.46 + depth * 0.98;
  const sizeScale = 0.48 + depth * 1.28;
  pollenState.particles.push({
    x: source.x + Math.cos(angle) * jitter,
    y: source.y + Math.sin(angle) * jitter,
    vx: windVector.x * (7 + Math.random() * 11) * speedScale + (Math.random() - 0.5) * 9 * depth,
    vy: windVector.y * (7 + Math.random() * 11) * speedScale + (Math.random() - 0.5) * 9 * depth,
    drift: (Math.random() - 0.5) * (5 + depth * 12),
    depth,
    age: 0,
    life: 3.6 + (1 - depth) * 2.2 + Math.random() * 2.8,
    size: (0.75 + Math.random() * 1.8) * sizeScale,
    alpha: 0.045 + depth * 0.17 + Math.random() * 0.08,
    rgb: source.rgb
  });
}

function getSourceColor(source, opacity) {
  return `rgba(${source.rgb.r}, ${source.rgb.g}, ${source.rgb.b}, ${opacity})`;
}

function getBloomClusters() {
  const clusters = [];
  pollenState.sources
    .slice()
    .sort((a, b) => b.intensity - a.intensity)
    .forEach((source) => {
      const match = clusters.find((cluster) => {
        const distance = Math.hypot(cluster.x - source.x, cluster.y - source.y);
        return distance < Math.max(86, cluster.radius * 0.68);
      });

      if (!match) {
        clusters.push({
          x: source.x,
          y: source.y,
          weight: source.intensity,
          radius: 72 + source.intensity * 34,
          count: 1,
          r: source.rgb.r * source.intensity,
          g: source.rgb.g * source.intensity,
          b: source.rgb.b * source.intensity
        });
        return;
      }

      const nextWeight = match.weight + source.intensity;
      match.x = (match.x * match.weight + source.x * source.intensity) / nextWeight;
      match.y = (match.y * match.weight + source.y * source.intensity) / nextWeight;
      match.weight = nextWeight;
      match.count += 1;
      match.radius = Math.max(match.radius, Math.hypot(match.x - source.x, match.y - source.y) + 62 + source.intensity * 24);
      match.r += source.rgb.r * source.intensity;
      match.g += source.rgb.g * source.intensity;
      match.b += source.rgb.b * source.intensity;
    });

  return clusters
    .map((cluster) => ({
      ...cluster,
      radius: Math.min(220, cluster.radius + Math.log(cluster.count + 1) * 26),
      rgb: {
        r: Math.round(cluster.r / cluster.weight),
        g: Math.round(cluster.g / cluster.weight),
        b: Math.round(cluster.b / cluster.weight)
      }
    }))
    .sort((a, b) => a.y - b.y);
}

function renderHeatLayer(rect, timestamp) {
  if (!pollenState.heatEnabled || pollenState.sources.length === 0) return;
  const clusters = getBloomClusters();
  const windVector = getWindVector();
  const windMagnitude = Math.hypot(windVector.x, windVector.y) || 1;
  const windUnit = {
    x: windVector.x / windMagnitude,
    y: windVector.y / windMagnitude
  };

  pollenContext.save();
  pollenContext.globalCompositeOperation = "multiply";

  clusters.forEach((cluster, index) => {
    const phase = timestamp * 0.0007 + index * 1.7;
    const breath = 1 + Math.sin(phase) * 0.055;
    const driftX = windUnit.x * Math.min(40, windVector.wind.speed * 10);
    const driftY = windUnit.y * Math.min(40, windVector.wind.speed * 10);
    const color = `${cluster.rgb.r}, ${cluster.rgb.g}, ${cluster.rgb.b}`;
    const radius = cluster.radius * breath;

    const plume = pollenContext.createRadialGradient(
      cluster.x,
      cluster.y,
      radius * 0.08,
      cluster.x + driftX,
      cluster.y + driftY,
      radius * 1.14
    );
    plume.addColorStop(0, `rgba(${color}, 0.2)`);
    plume.addColorStop(0.42, `rgba(${color}, 0.1)`);
    plume.addColorStop(0.72, `rgba(15, 118, 110, 0.035)`);
    plume.addColorStop(1, "rgba(255, 255, 255, 0)");

    pollenContext.fillStyle = plume;
    pollenContext.beginPath();
    pollenContext.ellipse(
      cluster.x + driftX * 0.34,
      cluster.y + driftY * 0.34,
      radius * (1.18 + windVector.wind.speed * 0.035),
      radius * 0.74,
      Math.atan2(windUnit.y, windUnit.x) * 0.42,
      0,
      Math.PI * 2
    );
    pollenContext.fill();
  });

  pollenContext.globalCompositeOperation = "source-over";
  clusters.forEach((cluster, index) => {
    renderContourSet(cluster, index, timestamp, windUnit);
  });

  pollenContext.restore();

  if (rect.width > 0 && rect.height > 0) {
    pollenCanvas.dataset.heatClusters = String(clusters.length);
  }
}

function renderContourSet(cluster, index, timestamp, windUnit) {
  const color = `${cluster.rgb.r}, ${cluster.rgb.g}, ${cluster.rgb.b}`;
  const basePhase = timestamp * 0.00045 + index * 2.31;
  const drift = Math.min(26, cluster.weight * 7);

  for (let ring = 0; ring < 3; ring += 1) {
    const t = ring / 2;
    const radius = cluster.radius * (0.42 + ring * 0.25 + Math.sin(basePhase + ring) * 0.018);
    const alpha = 0.16 - ring * 0.035;
    const offset = {
      x: windUnit.x * drift * (ring + 1) * 0.38,
      y: windUnit.y * drift * (ring + 1) * 0.38
    };

    pollenContext.save();
    pollenContext.lineWidth = ring === 0 ? 1.25 : 0.9;
    pollenContext.strokeStyle = `rgba(${color}, ${alpha})`;
    pollenContext.setLineDash(ring === 1 ? [7, 10] : []);
    pollenContext.lineDashOffset = -timestamp * (0.012 + ring * 0.005);
    drawOrganicContour(
      cluster.x + offset.x,
      cluster.y + offset.y,
      radius * (1.18 + t * 0.12),
      radius * (0.58 + t * 0.1),
      -0.16 + windUnit.x * 0.28,
      basePhase + ring * 1.4
    );
    pollenContext.stroke();
    pollenContext.restore();
  }
}

function drawOrganicContour(cx, cy, rx, ry, rotation, phase) {
  const steps = 44;
  const points = [];
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);

  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(angle * 3 + phase) * 0.032 +
      Math.sin(angle * 5.4 - phase * 0.7) * 0.022;
    const localX = Math.cos(angle) * rx * wobble;
    const localY = Math.sin(angle) * ry * wobble;
    points.push({
      x: cx + localX * cosRotation - localY * sinRotation,
      y: cy + localX * sinRotation + localY * cosRotation
    });
  }

  pollenContext.beginPath();
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    if (index === 0) {
      pollenContext.moveTo(midX, midY);
    } else {
      pollenContext.quadraticCurveTo(point.x, point.y, midX, midY);
    }
  });
  pollenContext.closePath();
}

function renderPollenFrame(timestamp) {
  if (!pollenContext || !pollenCanvas) return;
  const rect = pollenCanvas.getBoundingClientRect();
  const delta = Math.min(0.05, (timestamp - lastFrameTime || 16) / 1000);
  lastFrameTime = timestamp;
  pollenContext.clearRect(0, 0, rect.width, rect.height);
  renderHeatLayer(rect, timestamp);
  renderDepthColumns(timestamp);
  renderWindField(rect, delta, timestamp);

  if (pollenState.enabled && pollenState.sources.length > 0) {
    const spawnCount = Math.ceil((pollenState.density / 60) * pollenState.sources.length * 0.16);
    for (let index = 0; index < spawnCount; index += 1) {
      if (pollenState.particles.length < pollenState.density * 9) {
        spawnParticle(rect);
      }
    }
  }

  const aliveParticles = [];
  pollenState.particles.forEach((particle) => {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta + Math.sin((particle.age * (1.5 + particle.depth * 2.2) + particle.drift) * Math.PI) * (0.06 + particle.depth * 0.18);
    const progress = particle.age / particle.life;
    if (progress >= 1 || particle.x < -40 || particle.x > rect.width + 40 || particle.y < -40 || particle.y > rect.height + 40) {
      return;
    }
    aliveParticles.push(particle);
  });

  aliveParticles
    .sort((a, b) => a.depth - b.depth)
    .forEach((particle) => {
      const progress = particle.age / particle.life;
      const depthGlow = 0.5 + particle.depth * 0.75;
      const alpha = particle.alpha * Math.sin(progress * Math.PI);
      const size = particle.size * (1 + progress * (0.7 + particle.depth * 1.05));
      const glow = pollenContext.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, size * (2.8 + particle.depth * 1.4));
      glow.addColorStop(0, `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, ${(alpha * 1.15).toFixed(3)})`);
      glow.addColorStop(0.45, `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, ${(alpha * 0.42 * depthGlow).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, 0)`);
      pollenContext.fillStyle = glow;
      pollenContext.beginPath();
      pollenContext.arc(particle.x, particle.y, size * (2.6 + particle.depth), 0, Math.PI * 2);
      pollenContext.fill();

      pollenContext.beginPath();
      pollenContext.fillStyle = `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, ${(alpha * (0.72 + particle.depth * 0.45)).toFixed(3)})`;
      pollenContext.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      pollenContext.fill();
    });

  pollenState.particles = aliveParticles;

  animationFrameId = requestAnimationFrame(renderPollenFrame);
}

function renderDepthColumns(timestamp) {
  if (!depthEnabled || pollenState.sources.length === 0) return;
  const sortedSources = [...pollenState.sources].sort((a, b) => a.y - b.y);
  pollenContext.save();
  sortedSources.forEach((source) => {
    const pulse = 0.92 + Math.sin(timestamp * 0.0016 + source.x * 0.03) * 0.08;
    const height = (20 + Math.min(1.9, source.intensity) * 34) * pulse;
    const baseX = source.x + height * 0.12;
    const baseY = source.y + height * 0.58;
    const rgb = source.rgb;
    const color = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

    const baseGradient = pollenContext.createRadialGradient(baseX, baseY, 0, baseX, baseY, 22 + height * 0.12);
    baseGradient.addColorStop(0, `rgba(${color}, 0.18)`);
    baseGradient.addColorStop(0.58, `rgba(${color}, 0.07)`);
    baseGradient.addColorStop(1, `rgba(${color}, 0)`);
    pollenContext.fillStyle = baseGradient;
    pollenContext.beginPath();
    pollenContext.ellipse(baseX, baseY, 24 + height * 0.12, 8 + height * 0.03, -0.18, 0, Math.PI * 2);
    pollenContext.fill();

    const columnGradient = pollenContext.createLinearGradient(baseX, baseY, source.x, source.y);
    columnGradient.addColorStop(0, `rgba(${color}, 0.04)`);
    columnGradient.addColorStop(0.45, `rgba(${color}, 0.16)`);
    columnGradient.addColorStop(1, `rgba(${color}, 0.38)`);
    pollenContext.strokeStyle = columnGradient;
    pollenContext.lineWidth = 2.2;
    pollenContext.beginPath();
    pollenContext.moveTo(baseX, baseY);
    pollenContext.lineTo(source.x, source.y);
    pollenContext.stroke();

    const sideGradient = pollenContext.createLinearGradient(baseX - 5, baseY, source.x - 3, source.y);
    sideGradient.addColorStop(0, "rgba(255,255,255,0)");
    sideGradient.addColorStop(1, "rgba(255,255,255,0.42)");
    pollenContext.strokeStyle = sideGradient;
    pollenContext.lineWidth = 0.9;
    pollenContext.beginPath();
    pollenContext.moveTo(baseX - 5, baseY);
    pollenContext.lineTo(source.x - 3, source.y);
    pollenContext.stroke();

    const crown = pollenContext.createRadialGradient(source.x, source.y, 0, source.x, source.y, 20 + height * 0.08);
    crown.addColorStop(0, `rgba(${color}, 0.28)`);
    crown.addColorStop(0.45, `rgba(${color}, 0.1)`);
    crown.addColorStop(1, `rgba(${color}, 0)`);
    pollenContext.fillStyle = crown;
    pollenContext.beginPath();
    pollenContext.arc(source.x, source.y, 16 + height * 0.06, 0, Math.PI * 2);
    pollenContext.fill();
  });
  pollenContext.restore();
}

function getSeasonWindColors(month) {
  // Returns [primary, secondary] RGB triplets based on season
  if (month >= 3 && month <= 5) {
    // Spring: warm green → soft gold
    return [[72, 148, 96], [168, 142, 68]];
  }
  if (month >= 6 && month <= 8) {
    // Summer: rich teal → vibrant jade
    return [[38, 138, 108], [28, 148, 126]];
  }
  if (month >= 9 && month <= 11) {
    // Fall: warm amber → burnt orange
    return [[168, 118, 48], [188, 90, 50]];
  }
  // Winter: cool steel blue → deep indigo
  return [[82, 134, 188], [50, 88, 168]];
}

function renderWindField(rect, delta, timestamp) {
  if (!pollenState.windEnabled || pollenState.windLines.length === 0) return;
  const windVector = getWindVector();
  const magnitude = Math.hypot(windVector.x, windVector.y) || 1;
  const unitX = windVector.x / magnitude;
  const unitY = windVector.y / magnitude;
  const normalX = -unitY;
  const normalY = unitX;
  const [c1, c2] = getSeasonWindColors(state.month);
  pollenContext.save();
  pollenContext.lineCap = "round";
  pollenContext.lineJoin = "round";

  [...pollenState.windLines].sort((a, b) => a.depth - b.depth).forEach((line) => {
    const depthSpeed = 0.58 + line.depth * 0.84;
    line.x += unitX * windVector.wind.speed * 14 * line.speed * depthSpeed * delta;
    line.y += unitY * windVector.wind.speed * 14 * line.speed * depthSpeed * delta;
    line.x += normalX * Math.sin(timestamp * 0.0014 + line.phase) * (0.03 + line.depth * 0.08);
    line.y += normalY * Math.sin(timestamp * 0.0014 + line.phase) * (0.03 + line.depth * 0.08);

    if (line.x < -90 || line.x > rect.width + 90 || line.y < -90 || line.y > rect.height + 90) {
      if (Math.abs(unitX) > Math.abs(unitY)) {
        line.x = unitX > 0 ? -50 : rect.width + 50;
        line.y = Math.random() * rect.height;
      } else {
        line.y = unitY > 0 ? -50 : rect.height + 50;
        line.x = Math.random() * rect.width;
      }
    }

    const length = line.length * (0.68 + windVector.wind.speed / 5) * (0.74 + line.depth * 0.42);
    const startX = line.x - unitX * length * 0.5;
    const startY = line.y - unitY * length * 0.5;
    const endX = line.x + unitX * length * 0.5;
    const endY = line.y + unitY * length * 0.5;
    const lineAlpha = line.alpha * (0.55 + line.depth * 0.65);
    const blueAlpha = lineAlpha * (0.45 + line.depth * 0.22);
    const gradient = pollenContext.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0)`);
    gradient.addColorStop(0.36, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, ${lineAlpha})`);
    gradient.addColorStop(0.72, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, ${blueAlpha})`);
    gradient.addColorStop(1, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, 0)`);
    pollenContext.strokeStyle = gradient;
    pollenContext.lineWidth = 0.55 + line.depth * 1.3;
    pollenContext.beginPath();
    for (let segment = 0; segment <= 18; segment += 1) {
      const t = segment / 18;
      const point = windCurvePoint(t, line, timestamp, { x: startX, y: startY }, { x: endX, y: endY }, { x: normalX, y: normalY });
      if (segment === 0) {
        pollenContext.moveTo(point.x, point.y);
      } else {
        pollenContext.lineTo(point.x, point.y);
      }
    }
    pollenContext.stroke();

    const beadT = (line.beadOffset + timestamp * 0.00008 * line.speed * windVector.wind.speed) % 1;
    const bead = windCurvePoint(beadT, line, timestamp, { x: startX, y: startY }, { x: endX, y: endY }, { x: normalX, y: normalY });
    const beadRadius = 3.5 + line.depth * 5.5;
    const glow = pollenContext.createRadialGradient(bead.x, bead.y, 0, bead.x, bead.y, beadRadius);
    glow.addColorStop(0, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, ${lineAlpha * 1.45})`);
    glow.addColorStop(0.55, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, ${blueAlpha * 0.86})`);
    glow.addColorStop(1, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, 0)`);
    pollenContext.fillStyle = glow;
    pollenContext.beginPath();
    pollenContext.arc(bead.x, bead.y, beadRadius, 0, Math.PI * 2);
    pollenContext.fill();
  });

  pollenContext.restore();
}

function windCurvePoint(t, line, timestamp, start, end, normal) {
  const envelope = Math.sin(Math.PI * t);
  const wave =
    Math.sin(t * Math.PI * 1.7 + line.phase + timestamp * 0.001) * line.curve * envelope +
    Math.sin(t * Math.PI * 3.2 + line.phase * 0.7) * line.curve * 0.18 * envelope;
  return {
    x: start.x + (end.x - start.x) * t + normal.x * wave,
    y: start.y + (end.y - start.y) * t + normal.y * wave
  };
}

function startPollenAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(renderPollenFrame);
}

function renderWindPanel() {
  const { wind } = getWindVector();
  const arrowRotation = (wind.direction + 180) % 360;
  windArrow.style.transform = `rotate(${arrowRotation}deg)`;
  windArrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M7 10l5-5 5 5"/></svg>`;
  windBrief.textContent = `${wind.label} ${wind.speed.toFixed(1)} m/s`;
  windDirectionLabel.textContent = wind.label;
  windSpeedLabel.textContent = `${wind.speed.toFixed(1)} m/s`;
  pollenToggle.textContent = pollenState.enabled ? "暂停" : "播放";
  structureLayerToggle.classList.toggle("is-active", pollenState.structureEnabled);
  structureLayerToggle.setAttribute("aria-pressed", String(pollenState.structureEnabled));
  heatLayerToggle.classList.toggle("is-active", pollenState.heatEnabled);
  heatLayerToggle.setAttribute("aria-pressed", String(pollenState.heatEnabled));
  windLayerToggle.classList.toggle("is-active", pollenState.windEnabled);
  windLayerToggle.setAttribute("aria-pressed", String(pollenState.windEnabled));
}

function renderPlantControls() {
  plantFilter.innerHTML = plantNames.map((plant) => {
    const color = PLANT_COLORS[plant] || "#557c6f";
    return `<button class="plant-chip" data-plant="${plant}" type="button">
      <span class="chip-dot" style="--dot-color:${color}"></span>
      <span>${plant}</span>
    </button>`;
  }).join("");

  plantFilter.querySelectorAll(".plant-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const plant = button.dataset.plant;
      if (state.activePlants.has(plant)) {
        state.activePlants.delete(plant);
      } else {
        state.activePlants.add(plant);
      }
      render();
    });
  });
}



function renderSeasonTimeline(focusPlant = null) {
  const timelineSpots = focusPlant ? PLANT_SPOTS.filter((spot) => spot.plant === focusPlant) : PLANT_SPOTS;
  const profile = focusPlant ? getPlantProfile(focusPlant, timelineSpots) : null;
  const maxCount = Math.max(1, ...monthNumbers.map((month) => {
    return timelineSpots.filter((spot) => spot.months.includes(month)).length;
  }));
  const focusColor = focusPlant ? PLANT_COLORS[focusPlant] || "#557c6f" : "#557c6f";

  seasonTimeline.classList.toggle("is-focus-mode", Boolean(focusPlant));
  seasonTimeline.style.setProperty("--focus-plant-color", focusColor);

  seasonTimeline.innerHTML = monthNumbers.map((month) => {
    const activeCount = timelineSpots.filter((spot) => spot.months.includes(month)).length;
    const peakCount = timelineSpots.filter((spot) => spot.peak === month).length;
    const intensity = maxCount > 0 ? activeCount / maxCount : 0;
    const classes = ["season-month"];
    if (month === state.month) classes.push("is-current");
    if (peakCount > 0) classes.push("has-peak");
    if (focusPlant) {
      if (activeCount > 0) classes.push("is-focus-active");
      else classes.push("is-focus-muted");
    }
    return `<button
      class="${classes.join(" ")}"
      type="button"
      data-month="${month}"
      style="--month-intensity:${intensity.toFixed(3)};--month-color:${focusColor}"
      aria-label="${month}月，${focusPlant ? `${focusPlant}` : ""}${activeCount}个花期点位">
      <span>${month}</span>
      <i aria-hidden="true"></i>
    </button>`;
  }).join("");

  if (profile) {
    seasonTimeline.dataset.focusPlant = focusPlant;
    seasonTimeline.setAttribute(
      "aria-label",
      `季节时间轴，当前聚焦${focusPlant}，${state.month}月${profile.currentSpots.length}个点位`
    );
  } else {
    seasonTimeline.dataset.focusPlant = "";
    seasonTimeline.setAttribute("aria-label", "季节时间轴");
  }
}

function renderCalendar(focusPlant = null) {
  const header = ["<div class=\"calendar-head\">植物</div>"].concat(
    monthNumbers.map((month) => `<div class="calendar-head">${month}</div>`)
  );

  const rows = plantNames.flatMap((plant) => {
    const color = PLANT_COLORS[plant] || "#557c6f";
    const spots = PLANT_SPOTS.filter((spot) => spot.plant === plant);
    const focusState = focusPlant ? (plant === focusPlant ? "is-focus" : "is-context") : "";
    const label = `<button class="calendar-plant plant-chip ${focusState}" data-plant="${plant}" type="button">
      <span class="chip-dot" style="--dot-color:${color}"></span>
      <span>${plant}</span>
    </button>`;
    const cells = monthNumbers.map((month) => {
      const activeCount = spots.filter((spot) => spot.months.includes(month)).length;
      const peakCount = spots.filter((spot) => spot.peak === month).length;
      const classes = ["calendar-cell"];
      if (activeCount > 0) classes.push("is-active");
      if (peakCount > 0) classes.push("is-peak");
      if (month === state.month) classes.push("is-current");
      if (focusPlant) {
        classes.push(plant === focusPlant ? "is-focus" : "is-context");
      }
      const labelText = activeCount > 0 ? `${plant}${month}月：${activeCount}个点位` : `${plant}${month}月暂无点位`;
      return `<button
        class="${classes.join(" ")}"
        data-month="${month}"
        data-plant="${plant}"
        type="button"
        style="--cell-color:${color}"
        aria-label="${labelText}">
      </button>`;
    });
    return [label, ...cells];
  });

  bloomCalendar.innerHTML = header.concat(rows).join("");
}

function getAllergyRisk(month = state.month) {
  const activeSpots = PLANT_SPOTS.filter((spot) => spot.months.includes(month));
  if (activeSpots.length === 0) return { score: 0, label: "暂无数据", level: 0, plants: [] };

  let totalRisk = 0;
  let count = 0;
  const highPlants = [];

  activeSpots.forEach((spot) => {
    const status = getStatus(spot, month);
    if (!status.isActive) return;
    const allergyLevel = ALLERGY_PROFILE[spot.plant] || 1;
    const bloomFactor = status.isPeak ? 1 : 0.5;
    const pollenIntensity = POLLEN_PROFILE[spot.plant] || 0.4;
    totalRisk += allergyLevel * bloomFactor * pollenIntensity;
    count += 1;
    if (allergyLevel >= 2 && status.isPeak) {
      highPlants.push(spot.plant);
    }
  });

  if (count === 0) return { score: 0, label: "低", level: 1, plants: [] };

  const avgRisk = totalRisk / count;
  const wind = MONTHLY_WIND_MODEL[month] || MONTHLY_WIND_MODEL[4];
  const windFactor = Math.min(1, wind.speed / 4);
  const score = avgRisk * (0.8 + windFactor * 0.4);

  let level, label;
  if (score < 0.45) { level = 1; label = "低"; }
  else if (score < 0.9) { level = 2; label = "中"; }
  else if (score < 1.6) { level = 3; label = "高"; }
  else { level = 4; label = "极高"; }

  return { score, label, level, plants: [...new Set(highPlants)] };
}

function renderAllergy(risk) {
  const badge = document.querySelector("#allergyBadge");
  const valueEl = document.querySelector("#allergyValue");
  const plantsEl = document.querySelector("#allergyPlants");
  if (!badge) return;

  badge.textContent = risk.label;
  badge.className = `allergy-pill allergy-${risk.level}`;

  if (valueEl) {
    valueEl.textContent = risk.label;
    valueEl.className = `allergy-value allergy-${risk.level}`;
  }
  if (plantsEl) {
    if (risk.plants.length > 0) {
      plantsEl.innerHTML = risk.plants
        .map((p) => `<li style="--allergy-plant-color:${PLANT_COLORS[p] || "#667085"}">${p} 正值盛花期，花粉致敏性高</li>`)
        .join("");
      plantsEl.hidden = false;
    } else {
      plantsEl.innerHTML = "";
      plantsEl.hidden = true;
    }
  }
}

function renderStats(visibleSpots, recommended, focusPlant = null, narrativeSpots = visibleSpots) {
  const activeDistricts = new Set(recommended.map((spot) => spot.district));
  const activePlants = new Set(recommended.map((spot) => spot.plant));
  const countEl = document.querySelector("#activeCount");
  const prev = Number(countEl.textContent);
  countEl.textContent = recommended.length;
  if (prev !== recommended.length) {
    countEl.classList.add("count-flip");
    setTimeout(() => countEl.classList.remove("count-flip"), 300);
  }
  document.querySelector("#plantCount").textContent = activePlants.size;
  document.querySelector("#districtCount").textContent = activeDistricts.size;
  document.querySelector("#listCount").textContent = `${recommended.length}/${narrativeSpots.length}`;
  document.body.classList.toggle("focus-mode", Boolean(focusPlant));
  document.body.style.setProperty("--focus-plant-color", focusPlant ? PLANT_COLORS[focusPlant] || "#557c6f" : "#557c6f");
  renderAllergy(getAllergyRisk());
}

function renderMonth(focusPlant = null) {
  monthLabel.textContent = `${state.month}月`;
  seasonLabel.textContent = seasons[state.month];
  topbarMonth.textContent = `${state.month}月`;
  topbarSeason.textContent = focusPlant ? `${seasons[state.month]} · ${focusPlant}` : seasons[state.month];
  monthRange.value = state.month;
}

function renderMarkerState(visibleSpots, focusPlant = null) {
  if (hoverPopup) hoverPopup.remove();
  const visibleIds = new Set(visibleSpots.map((spot) => spot.id));
  PLANT_SPOTS.forEach((spot) => {
    const marker = markerById.get(spot.id);
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const isVisible = visibleIds.has(spot.id);
    const isContext = Boolean(focusPlant && spot.plant !== focusPlant);
    el.style.opacity = isVisible ? (isContext ? "0.52" : "1") : "0";
    el.style.pointerEvents = isVisible ? "auto" : "none";
    const color = PLANT_COLORS[spot.plant] || "#557c6f";
    el.innerHTML = `<span class="${getMarkerClass(spot, focusPlant)}" style="--marker-color:${color}"></span>`;
    const status = getStatus(spot);
    const selected = state.selectedId === spot.id;
    el.style.zIndex = String(selected ? 900 : isContext ? 120 : status.isPeak ? 620 : status.isActive ? 420 : 80);
  });
}

function renderPlantControlState(focusPlant = null) {
  plantFilter.querySelectorAll(".plant-chip").forEach((button) => {
    button.classList.toggle("is-active", state.activePlants.has(button.dataset.plant));
    button.classList.toggle("is-context", Boolean(focusPlant && button.dataset.plant !== focusPlant && !state.activePlants.has(button.dataset.plant)));
    button.classList.toggle("is-focus", button.dataset.plant === focusPlant);
  });
}

function renderDetails(visibleSpots, recommended, focusPlant = null, narrativeSpots = visibleSpots) {
  const selected =
    getVisibleSelectedSpot(narrativeSpots) ||
    recommended[0] ||
    narrativeSpots[0] ||
    visibleSpots[0];

  if (!selected) {
    detailPanel.innerHTML = `<p class="muted">没有匹配的点位。可以清空搜索或取消植物筛选。</p>`;
    return;
  }

  if (state.selectedId && detailSection && !detailSection.open) {
    detailSection.open = true;
  }

  const status = getStatus(selected);
  const color = PLANT_COLORS[selected.plant] || "#557c6f";
  const statusColor = getStatusThemeColor(status);
  const plantImage = PLANT_IMAGES[selected.plant] || "";
  const profile = getPlantProfile(selected.plant, narrativeSpots);
  const focusSummary = `${state.month}月 ${profile.currentSpots.length} 个点位 · ${profile.districtCount} 个区域`;
  detailPanel.innerHTML = `
    ${focusPlant ? `<div class="focus-ribbon" style="--focus-ribbon-color:${color}">
      <span>聚焦植物</span>
      <strong>${selected.plant}</strong>
      <small>${focusSummary}</small>
    </div>` : ""}
    ${plantImage ? `<figure class="detail-hero" style="--detail-hero-color:${color};--detail-status-color:${statusColor}">
      <div class="detail-hero-frame">
        <img src="${plantImage}" alt="${selected.plant}" loading="lazy" />
      </div>
      <figcaption>
        <span>${selected.plant}</span>
        <strong>${selected.district} · ${selected.place}</strong>
      </figcaption>
    </figure>` : ""}
    <p class="detail-kicker" style="color:${color}">${selected.plant} · ${status.label}</p>
    <h2>${selected.place}</h2>
    <div class="detail-grid">
      <div><span>所在区</span><strong>${selected.district}</strong></div>
      <div><span>观赏时间</span><strong>${selected.bloom}</strong></div>
      <div><span>规模信息</span><strong>${selected.countText}</strong></div>
      <div><span>数据来源</span><strong>${selected.source.replace("北京市园林绿化局 ", "")}</strong></div>
    </div>
    <p class="detail-desc">${selected.description}</p>
  `;

  const marker = markerById.get(selected.id);
  if (marker && map) {
    // Close previous popup if any
    const prevPopup = marker.getPopup();
    if (prevPopup) prevPopup.remove();
    const popup = new maplibregl.Popup({
      offset: [0, -16],
      closeButton: false,
      closeOnClick: false,
      maxWidth: "240px",
      className: "plant-popup"
    }).setHTML(`<strong>${selected.place}</strong><br><span style="color:${color}">${selected.plant}</span>`);
    marker.setPopup(popup);
    popup.addTo(map);
  }
}

function renderSpotList(recommended, focusPlant = null) {
  if (recommended.length === 0) {
    spotList.innerHTML = `<p class="muted">这个月份没有匹配点位。试试换一个月份或放宽筛选。</p>`;
    return;
  }

  spotList.innerHTML = recommended.slice(0, 12).map((spot) => {
    const status = getStatus(spot);
    return `<button class="spot-card ${focusPlant && spot.plant === focusPlant ? "is-focus" : ""}" data-id="${spot.id}" type="button">
      <div class="spot-title">
        <strong>${spot.place}</strong>
        <span class="status-pill">${status.label}</span>
      </div>
      <p class="spot-meta">${spot.district} · ${spot.plant} · ${spot.bloom}</p>
    </button>`;
  }).join("");

  spotList.querySelectorAll(".spot-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.id;
      setPanelVisible(true);
      const selected = PLANT_SPOTS.find((spot) => spot.id === state.selectedId);
      if (selected && map) {
        map.panTo(getMapLatLng(selected), { animate: true, duration: 600 });
      }
      render();
      focusPanelOnDetails();
    });
  });
}

function render() {
  const visibleSpots = getVisibleSpots();
  const focusPlant = getFocusPlant(visibleSpots);
  const narrativeSpots = getNarrativeSpots(visibleSpots, focusPlant);
  const recommended = getRecommendedSpots(narrativeSpots);
  renderMonth(focusPlant);
  renderStats(visibleSpots, recommended, focusPlant, narrativeSpots);
  renderMarkerState(visibleSpots, focusPlant);
  renderPlantControlState(focusPlant);
  renderCalendar(focusPlant);
  renderWindPanel();
  renderSeasonTimeline(focusPlant);
  updatePollenSources(narrativeSpots);
  renderDetails(visibleSpots, recommended, focusPlant, narrativeSpots);
  renderSpotList(recommended, focusPlant);
}

monthRange.addEventListener("input", (event) => {
  state.month = Number(event.target.value);
  state.selectedId = null;
  render();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  state.selectedId = null;
  searchClear.classList.toggle("is-visible", event.target.value.length > 0);
  render();
});

resetFilters.addEventListener("click", () => {
  state.activePlants.clear();
  state.query = "";
  searchInput.value = "";
  searchClear.classList.remove("is-visible");
  state.selectedId = null;
  render();
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  state.selectedId = null;
  searchClear.classList.remove("is-visible");
  render();
  searchInput.focus();
});

pollenToggle.addEventListener("click", () => {
  pollenState.enabled = !pollenState.enabled;
  if (!pollenState.enabled) {
    pollenState.particles = [];
  }
  renderWindPanel();
});

pollenDensity.addEventListener("input", (event) => {
  pollenState.density = Number(event.target.value);
});

windLayerToggle.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  pollenState.windEnabled = !pollenState.windEnabled;
  renderWindPanel();
});

windLayerToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

heatLayerToggle.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  pollenState.heatEnabled = !pollenState.heatEnabled;
  pollenCanvas.dataset.heatClusters = "0";
  renderWindPanel();
});

heatLayerToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

structureLayerToggle.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  pollenState.structureEnabled = !pollenState.structureEnabled;
  if (map && mapLoaded) {
    structureLayerIds.forEach((id) => {
      map.setLayoutProperty(id, "visibility", pollenState.structureEnabled ? "visible" : "none");
    });
    structureMarkers.forEach((m) => {
      m.getElement().style.display = pollenState.structureEnabled ? "" : "none";
    });
  }
  renderWindPanel();
});

structureLayerToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

panelToggle.addEventListener("click", () => {
  setPanelVisible(!panelVisible);
});

seasonTimeline.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  state.month = Number(target.dataset.month);
  state.selectedId = null;
  render();
});

document.addEventListener("click", (event) => {
  if (!panelVisible) return;
  if (suppressNextPanelDismiss) return;
  const isPanelClick = controlPanel.contains(event.target);
  const isDockClick = panelControlDock.contains(event.target);
  if (!isPanelClick && !isDockClick) {
    setPanelVisible(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && panelVisible) {
    setPanelVisible(false);
    panelToggle.focus();
  }
});

bloomCalendar.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.month) {
    state.month = Number(target.dataset.month);
    state.activePlants.clear();
    state.activePlants.add(target.dataset.plant);
    state.selectedId = null;
  } else if (target.dataset.plant) {
    const plant = target.dataset.plant;
    if (state.activePlants.has(plant)) {
      state.activePlants.delete(plant);
    } else {
      state.activePlants.add(plant);
    }
  }

  render();
});

fitActive.addEventListener("click", () => {
  fitMapToSpots(getRecommendedSpots());
});

fitAll.addEventListener("click", () => {
  fitMapToSpots(PLANT_SPOTS);
});

depthToggle.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setDepthEnabled(!depthEnabled);
});

depthToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

window.addEventListener("resize", () => {
  if (!map) return;
  map.resize();
  resizePollenCanvas();
  updatePollenSources();
});

initMap();
renderPlantControls();
render();

// ─── Entry Intro Animation ───
let introSkipRequested = false;

function createIntroOverlay() {
  const div = document.createElement("div");
  div.id = "introOverlay";
  div.className = "intro-overlay";
  div.innerHTML = `
    <div class="intro-backdrop"></div>
    <div class="intro-label" id="introLabel"></div>
    <button class="intro-skip" id="introSkip" type="button">跳过 ›</button>
  `;
  document.querySelector(".map-stage").appendChild(div);
  document.getElementById("introSkip").addEventListener("click", () => {
    introSkipRequested = true;
    if (map) map.stop();
  });
  return div;
}

function showIntroLabel(text) {
  const el = document.getElementById("introLabel");
  if (!el) return;
  el.textContent = text;
  el.classList.add("is-visible");
}

function hideIntroLabel() {
  const el = document.getElementById("introLabel");
  if (el) el.classList.remove("is-visible");
}

function flyToPromise(opts) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    map.once("moveend", finish);
    map.flyTo(opts);
    setTimeout(finish, opts.duration + 500);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playIntroAnimation() {
  if (!map) return;

  // Ensure 3D depth is on for dramatic effect
  if (!depthEnabled) setDepthEnabled(true);
  // Close panel for full-screen view
  if (panelVisible) setPanelVisible(false);

  createIntroOverlay();
  document.body.classList.add("is-intro");
  introSkipRequested = false;

  const legs = [
    // 1 — 一月：蜡梅 · 颐和园
    {
      center: [116.275, 40.0],
      zoom: 13,
      pitch: 20,
      bearing: 30,
      month: 1,
      spotId: "yihe-wintersweet",
      label: "蜡梅 · 颐和园 · 一月",
      duration: 2800,
      pause: 600,
    },
    // 2 — 二月：迎春 · 中山公园
    {
      center: [116.390, 39.909],
      zoom: 14,
      pitch: 25,
      bearing: 180,
      month: 2,
      spotId: "zhongshan-jasmine",
      label: "迎春 · 中山公园 · 二月",
      duration: 2400,
      pause: 600,
    },
    // 3 — 三月：樱花 · 玉渊潭
    {
      center: [116.307, 39.918],
      zoom: 14,
      pitch: 30,
      bearing: 0,
      month: 3,
      spotId: "yuyuantan-sakura",
      label: "樱花 · 玉渊潭 · 三月",
      duration: 2400,
      pause: 600,
    },
    // 4 — 四月：海棠 · 元大都遗址公园
    {
      center: [116.414, 39.976],
      zoom: 13,
      pitch: 48,
      bearing: 315,
      month: 4,
      spotId: "yuandadu-crabapple",
      label: "海棠 · 元大都 · 四月",
      duration: 2600,
      pause: 600,
    },
    // 5 — 五月：牡丹 · 景山公园
    {
      center: [116.397, 39.923],
      zoom: 14,
      pitch: 40,
      bearing: 180,
      month: 5,
      spotId: "jingshan-peony",
      label: "牡丹 · 景山 · 五月",
      duration: 2800,
      pause: 800,
    },
    // 6 — 六月：荷花 · 紫竹院公园
    {
      center: [116.310, 39.944],
      zoom: 14,
      pitch: 15,
      bearing: 0,
      month: 6,
      spotId: "zizhuyuan-lotus",
      label: "荷花 · 紫竹院 · 六月",
      duration: 2200,
      pause: 600,
    },
    // 7 — 七月：月季 · 大望京公园
    {
      center: [116.486, 40.003],
      zoom: 14,
      pitch: 35,
      bearing: 135,
      month: 7,
      spotId: "dawangjing-rose",
      label: "月季 · 大望京 · 七月",
      duration: 2600,
      pause: 600,
    },
    // 8 — 八月：向日葵 · 奥林匹克森林公园
    {
      center: [116.396, 40.020],
      zoom: 14,
      pitch: 45,
      bearing: 135,
      month: 8,
      spotId: "aosen-sunflower",
      label: "向日葵 · 奥森 · 八月",
      duration: 2400,
      pause: 600,
    },
    // 9 — 九月：菊花 · 北海公园
    {
      center: [116.388, 39.924],
      zoom: 13.5,
      pitch: 25,
      bearing: 45,
      month: 9,
      spotId: "beihai-chrysanthemum",
      label: "菊花 · 北海 · 九月",
      duration: 2400,
      pause: 600,
    },
    // 10 — 十月：银杏 · 香山公园
    {
      center: [116.182, 39.989],
      zoom: 13,
      pitch: 35,
      bearing: 0,
      month: 10,
      spotId: "xiangshan-ginkgo",
      label: "银杏 · 香山 · 十月",
      duration: 2800,
      pause: 800,
    },
    // 11 — 十一月：粉黛乱子草 · 官庄公园
    {
      center: [116.588, 39.913],
      zoom: 13,
      pitch: 20,
      bearing: 0,
      month: 11,
      spotId: "guanzhuang-muhly",
      label: "粉黛乱子草 · 官庄 · 十一月",
      duration: 2600,
      pause: 600,
    },
    // 12 — 十二月：蜡梅 · 颐和园（与一月首尾呼应）
    {
      center: [116.275, 40.0],
      zoom: 13,
      pitch: 20,
      bearing: 30,
      month: 12,
      spotId: "yihe-wintersweet",
      label: "蜡梅 · 颐和园 · 十二月",
      duration: 2600,
      pause: 600,
    },
    // 13 — 返回全景
    {
      center: [116.42, 39.93],
      zoom: 11.2,
      pitch: 48,
      bearing: 315,
      month: 4,
      spotId: null,
      label: "",
      duration: 3000,
      pause: 0,
    },
  ];

  try {
    for (const leg of legs) {
      if (introSkipRequested) break;

      // Set month and display label
      state.month = leg.month;
      state.selectedId = leg.spotId || null;
      render();

      if (leg.label) {
        showIntroLabel(leg.label);
      } else {
        hideIntroLabel();
      }

      await flyToPromise({
        center: leg.center,
        zoom: leg.zoom,
        pitch: leg.pitch,
        bearing: leg.bearing,
        duration: leg.duration,
      });

      if (!introSkipRequested && leg.pause) {
        await sleep(leg.pause);
      }
    }
  } finally {
    document.body.classList.remove("is-intro");
    const overlay = document.getElementById("introOverlay");
    if (overlay) overlay.remove();

    // If skipped, restore to default view
    if (introSkipRequested) {
      state.month = 4;
      state.selectedId = null;
      render();
      map.flyTo({
        center: [116.42, 39.93],
        zoom: 11.2,
        pitch: 48,
        bearing: 315,
        duration: 600,
      });
    }
  }
}
