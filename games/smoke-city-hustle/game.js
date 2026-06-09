/* =========================
   RICH BIZNESS MOBILE
   /games/smoke-city-hustle/game.js

   SMOKE CITY HUSTLE
   Full Extreme One-File Canvas Game
   Mobile + Desktop Controls
   No External Dependencies
========================= */

(() => {
  "use strict";

  const GAME_ID = "smoke-city-hustle";
  const STORAGE_KEY = "rb_smoke_city_hustle_save_v1";

  const CONFIG = Object.freeze({
    title: "Smoke City Hustle",
    brand: "Rich Bizness LLC",

    gravity: 0.9,
    jumpPower: -17.5,

    baseSpeed: 5.8,
    maxSpeed: 17.6,
    speedRamp: 0.00068,

    spawnBaseMs: 690,
    spawnMinMs: 250,

    playerYRatio: 0.78,

    coinValue: 10,
    cashValue: 25,
    gemValue: 70,
    packageValue: 45,

    shieldMs: 6400,
    magnetMs: 6200,
    boostMs: 5200,
    smokeBombMs: 4800,
    slowMoMs: 3000,

    colors: {
      black: "#020402",
      green: "#66ff99",
      green2: "#00ff88",
      emerald: "#10b981",
      gold: "#ffd86b",
      gold2: "#facc15",
      red: "#ff3355",
      orange: "#ff8a1f",
      blue: "#38bdf8",
      purple: "#a855f7",
      white: "#ffffff"
    }
  });

  const ASSETS = Object.freeze({
    hero: "/images/brand/hero-banner.png",
    avatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
    gaming: "/images/brand/gaming-hero.png.jpeg",
    smokeCity: "/images/C54535CD-E2B2-481B-81C8-4CFA81CC2ACD.png"
  });

  const POWERUPS = Object.freeze({
    shield: {
      label: "SHIELD",
      icon: "🛡️",
      color: "#38bdf8"
    },
    magnet: {
      label: "MAGNET",
      icon: "🧲",
      color: "#a855f7"
    },
    boost: {
      label: "BOOST",
      icon: "⚡",
      color: "#ffd86b"
    },
    smoke: {
      label: "SMOKE",
      icon: "💨",
      color: "#66ff99"
    },
    slowmo: {
      label: "SLOW",
      icon: "🌀",
      color: "#00ffcc"
    }
  });

  const state = {
    booted: false,
    running: false,
    paused: false,
    gameOver: false,

    canvas: null,
    ctx: null,
    dpr: 1,
    w: 390,
    h: 844,

    lastTime: 0,
    elapsed: 0,
    shake: 0,
    flash: 0,

    score: 0,
    cash: 0,
    gems: 0,
    distance: 0,
    combo: 1,
    comboTimer: 0,

    level: 1,
    xp: 0,
    rank: "Block Runner",

    highScore: 0,
    totalCash: 0,
    totalRuns: 0,

    speed: CONFIG.baseSpeed,
    spawnTimer: 0,
    spawnEvery: CONFIG.spawnBaseMs,

    lane: 1,
    targetLane: 1,

    playerX: 0,
    playerY: 0,
    playerZ: 0,
    playerVY: 0,
    playerLean: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    dashing: false,
    dashTimer: 0,
    invincibleTimer: 0,

    shieldTimer: 0,
    magnetTimer: 0,
    boostTimer: 0,
    smokeBombTimer: 0,
    slowmoTimer: 0,

    objects: [],
    particles: [],
    smoke: [],
    texts: [],
    stars: [],
    roadLines: [],
    buildings: [],
    neonSigns: [],

    input: {
      pointerDown: false,
      startX: 0,
      startY: 0
    },

    images: {},
    imageReady: {}
  };

  const qs = (selector, root = document) => root.querySelector(selector);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const chance = (odds) => Math.random() < odds;

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const save = JSON.parse(raw);

      state.highScore = Number(save.highScore || 0);
      state.totalCash = Number(save.totalCash || 0);
      state.totalRuns = Number(save.totalRuns || 0);
      state.xp = Number(save.xp || 0);
      state.level = Number(save.level || 1);
      state.rank = save.rank || getRank(state.level);
    } catch {
      state.highScore = 0;
      state.totalCash = 0;
      state.totalRuns = 0;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          highScore: state.highScore,
          totalCash: state.totalCash,
          totalRuns: state.totalRuns,
          xp: state.xp,
          level: state.level,
          rank: state.rank
        })
      );
    } catch {
      /* private mode storage can fail */
    }
  }

  function getRank(level) {
    if (level >= 60) return "Smoke City King";
    if (level >= 45) return "City Boss";
    if (level >= 32) return "Trap Route Legend";
    if (level >= 22) return "Smoke Runner Elite";
    if (level >= 13) return "Street Hustler";
    if (level >= 7) return "Block Runner";
    return "Rookie Runner";
  }

  function updateLevelFromXp() {
    state.level = Math.max(1, Math.floor(state.xp / 1000) + 1);
    state.rank = getRank(state.level);

    const levelBase = (state.level - 1) * 1000;
    const nextLevel = state.level * 1000;
    const percent = clamp(((state.xp - levelBase) / (nextLevel - levelBase)) * 100, 0, 100);
    const remaining = Math.max(0, nextLevel - state.xp);

    window.dispatchEvent(
      new CustomEvent("rb:xp-gauge-update", {
        detail: {
          route: GAME_ID,
          xp: state.xp,
          level: state.level,
          rank: state.rank,
          nextLevel,
          remaining,
          percent
        }
      })
    );
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;

    loadSave();
    mountCanvas();
    loadImages();
    buildWorld();
    bindEvents();
    resetRun();

    requestAnimationFrame(loop);
  }

  function mountCanvas() {
    const existing = qs("#smokeCityHustleCanvas") || qs("canvas[data-smoke-city-hustle]");
    const container =
      qs("#smoke-city-hustle") ||
      qs("[data-game='smoke-city-hustle']") ||
      qs(".smoke-city-hustle") ||
      document.body;

    const canvas = existing || document.createElement("canvas");

    canvas.id = canvas.id || "smokeCityHustleCanvas";
    canvas.dataset.smokeCityHustle = "true";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.background = "#020402";

    if (!existing) {
      container.appendChild(canvas);
    }

    state.canvas = canvas;
    state.ctx = canvas.getContext("2d", { alpha: false });

    resize();
  }

  function loadImages() {
    Object.entries(ASSETS).forEach(([key, src]) => {
      const img = new Image();

      img.onload = () => {
        state.images[key] = img;
        state.imageReady[key] = true;
      };

      img.onerror = () => {
        state.imageReady[key] = false;
      };

      img.src = src;
    });
  }

  function buildWorld() {
    state.stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: rand(0.35, 2.2),
      a: rand(0.15, 0.88),
      p: rand(0, Math.PI * 2)
    }));

    state.roadLines = Array.from({ length: 30 }, (_, i) => ({
      y: (i / 30) * state.h,
      a: rand(0.45, 0.98)
    }));

    state.buildings = Array.from({ length: 34 }, (_, i) => ({
      side: i % 2 === 0 ? -1 : 1,
      y: rand(-state.h, state.h),
      w: rand(34, 82),
      h: rand(100, 310),
      glow: rand(0.2, 0.85),
      windowColor: chance(0.5) ? "#66ff99" : "#ffd86b"
    }));

    state.neonSigns = Array.from({ length: 12 }, (_, i) => ({
      side: i % 2 === 0 ? -1 : 1,
      y: rand(-state.h, state.h),
      text: ["SMOKE", "CITY", "RICH", "BIZ", "OPEN", "TRAP", "RUN"][Math.floor(rand(0, 7))],
      color: ["#66ff99", "#ffd86b", "#38bdf8", "#a855f7"][Math.floor(rand(0, 4))]
    }));
  }

  function bindEvents() {
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    state.canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.running) {
        state.paused = true;
      }
    });

    window.RB_SMOKE_CITY_HUSTLE = {
      start,
      pause,
      resume,
      restart,
      resetSave,
      getState: () => ({ ...state })
    };
  }

  function resize() {
    if (!state.canvas) return;

    const parent = state.canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();

    const cssW = Math.max(320, rect.width || window.innerWidth);
    const cssH = Math.max(560, rect.height || window.innerHeight);

    state.w = cssW;
    state.h = cssH;
    state.dpr = Math.min(2, window.devicePixelRatio || 1);

    state.canvas.width = Math.floor(cssW * state.dpr);
    state.canvas.height = Math.floor(cssH * state.dpr);
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.playerY = state.h * CONFIG.playerYRatio;
    state.playerX = laneX(state.lane);

    buildWorld();
  }

  function laneX(lane) {
    const center = state.w / 2;
    const gap = Math.min(118, state.w * 0.27);
    return center + (lane - 1) * gap;
  }

  function resetRun() {
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.score = 0;
    state.cash = 0;
    state.gems = 0;
    state.distance = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.speed = CONFIG.baseSpeed;
    state.spawnTimer = 0;
    state.spawnEvery = CONFIG.spawnBaseMs;
    state.lane = 1;
    state.targetLane = 1;
    state.playerX = laneX(1);
    state.playerZ = 0;
    state.playerVY = 0;
    state.playerLean = 0;
    state.jumping = false;
    state.sliding = false;
    state.slideTimer = 0;
    state.dashing = false;
    state.dashTimer = 0;
    state.invincibleTimer = 1300;
    state.shieldTimer = 0;
    state.magnetTimer = 0;
    state.boostTimer = 0;
    state.smokeBombTimer = 0;
    state.slowmoTimer = 0;
    state.objects.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.smoke.length = 0;

    updateLevelFromXp();
  }

  function start() {
    if (state.running && !state.gameOver) return;

    if (state.gameOver) {
      resetRun();
    }

    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.totalRuns += 1;
    saveGame();

    burst(state.playerX, state.playerY, CONFIG.colors.green, 26, 1.8);
    floatingText("HUSTLE UP", state.w / 2, state.h * 0.38, CONFIG.colors.gold);
  }

  function pause() {
    state.paused = true;
  }

  function resume() {
    state.paused = false;
  }

  function restart() {
    resetRun();
    start();
  }

  function resetSave() {
    localStorage.removeItem(STORAGE_KEY);
    state.highScore = 0;
    state.totalCash = 0;
    state.totalRuns = 0;
    state.xp = 0;
    state.level = 1;
    state.rank = getRank(1);
    resetRun();
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (["arrowleft", "a"].includes(key)) moveLane(-1);
    if (["arrowright", "d"].includes(key)) moveLane(1);
    if (["arrowup", "w", " "].includes(key)) jump();
    if (["arrowdown", "s"].includes(key)) slide();
    if (key === "shift") dash();
    if (key === "enter") start();
    if (key === "p") state.paused = !state.paused;
    if (key === "r") restart();
  }

  function onKeyUp() {}

  function onPointerDown(event) {
    event.preventDefault();

    state.input.pointerDown = true;
    state.input.startX = event.clientX;
    state.input.startY = event.clientY;

    if (!state.running || state.gameOver) {
      start();
    }
  }

  function onPointerMove(event) {
    if (!state.input.pointerDown) return;

    const dx = event.clientX - state.input.startX;
    const dy = event.clientY - state.input.startY;

    if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
      state.input.startX = event.clientX;
      state.input.startY = event.clientY;
    }

    if (Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) jump();
      if (dy > 0) slide();
      state.input.startX = event.clientX;
      state.input.startY = event.clientY;
    }
  }

  function onPointerUp() {
    state.input.pointerDown = false;
  }

  function moveLane(dir) {
    if (state.gameOver) return;

    const oldLane = state.lane;
    state.targetLane = clamp(state.targetLane + dir, 0, 2);
    state.lane = state.targetLane;

    if (oldLane !== state.lane) {
      state.playerLean = dir * 1;
      burst(laneX(state.lane), state.playerY + 30, CONFIG.colors.green, 9, 1);
    }
  }

  function jump() {
    if (state.gameOver || state.jumping) return;

    state.jumping = true;
    state.playerVY = CONFIG.jumpPower;
    burst(state.playerX, state.playerY + 44, CONFIG.colors.gold, 15, 1.2);
  }

  function slide() {
    if (state.gameOver || state.sliding) return;

    state.sliding = true;
    state.slideTimer = 520;
    addSmoke(state.playerX, state.playerY + 28, 1.8);
    burst(state.playerX, state.playerY + 52, CONFIG.colors.blue, 12, 1);
  }

  function dash() {
    if (state.gameOver || state.dashing) return;

    state.dashing = true;
    state.dashTimer = 260;
    state.invincibleTimer = Math.max(state.invincibleTimer, 420);
    state.flash = 0.65;
    burst(state.playerX, state.playerY + 16, CONFIG.colors.gold, 30, 2.1);

    for (let i = 0; i < 8; i += 1) {
      addSmoke(state.playerX + rand(-28, 28), state.playerY + rand(0, 40), 1.4);
    }
  }

  function loop(time) {
    const dt = Math.min(40, time - (state.lastTime || time));
    state.lastTime = time;

    if (!state.paused && state.running && !state.gameOver) {
      update(dt, time);
    } else {
      updateIdle(dt, time);
    }

    draw(time);
    requestAnimationFrame(loop);
  }

  function update(dt, time) {
    const slowFactor = state.slowmoTimer > 0 ? 0.55 : 1;
    const boostFactor = state.boostTimer > 0 ? 1.55 : 1;
    const smokeSafe = state.smokeBombTimer > 0 ? 0.72 : 1;

    state.elapsed += dt;
    state.speed = clamp(CONFIG.baseSpeed + state.elapsed * CONFIG.speedRamp, CONFIG.baseSpeed, CONFIG.maxSpeed) * boostFactor;
    state.distance += state.speed * dt * 0.012 * slowFactor;
    state.score += Math.floor(state.speed * dt * 0.026 * state.combo);

    state.spawnEvery = clamp(CONFIG.spawnBaseMs - state.elapsed * 0.03, CONFIG.spawnMinMs, CONFIG.spawnBaseMs);
    state.spawnTimer -= dt * smokeSafe;

    if (state.spawnTimer <= 0) {
      spawnPattern();
      state.spawnTimer = state.spawnEvery * rand(0.7, 1.22);
    }

    updateTimers(dt);
    updatePlayer(dt);
    updateObjects(dt, slowFactor);
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt, slowFactor);
    updateCombo(dt);
  }

  function updateIdle(dt) {
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt, 0.58);

    if (!state.running && chance(0.025)) {
      addSmoke(rand(0, state.w), state.h + 10, rand(0.5, 1.3));
    }
  }

  function updateTimers(dt) {
    state.shake = Math.max(0, state.shake - dt * 0.004);
    state.flash = Math.max(0, state.flash - dt * 0.004);

    state.shieldTimer = Math.max(0, state.shieldTimer - dt);
    state.magnetTimer = Math.max(0, state.magnetTimer - dt);
    state.boostTimer = Math.max(0, state.boostTimer - dt);
    state.smokeBombTimer = Math.max(0, state.smokeBombTimer - dt);
    state.slowmoTimer = Math.max(0, state.slowmoTimer - dt);
    state.invincibleTimer = Math.max(0, state.invincibleTimer - dt);

    state.dashTimer = Math.max(0, state.dashTimer - dt);
    if (state.dashTimer <= 0) state.dashing = false;

    state.slideTimer = Math.max(0, state.slideTimer - dt);
    if (state.slideTimer <= 0) state.sliding = false;
  }

  function updateCombo(dt) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);

    if (state.comboTimer <= 0) {
      state.combo = Math.max(1, state.combo - 0.018);
    }
  }

  function updatePlayer(dt) {
    const targetX = laneX(state.lane);
    state.playerX = lerp(state.playerX, targetX, 0.22);
    state.playerLean = lerp(state.playerLean, 0, 0.14);

    if (state.jumping) {
      state.playerZ += state.playerVY;
      state.playerVY += CONFIG.gravity;

      if (state.playerZ >= 0) {
        state.playerZ = 0;
        state.playerVY = 0;
        state.jumping = false;
        burst(state.playerX, state.playerY + 50, CONFIG.colors.green, 10, 1);
      }
    }

    if (state.dashing) {
      addTrail(state.playerX, state.playerY - state.playerZ, CONFIG.colors.gold);
    }

    if (state.shieldTimer > 0) {
      addTrail(state.playerX, state.playerY - state.playerZ, CONFIG.colors.blue, 0.35);
    }

    if (state.magnetTimer > 0) {
      addTrail(state.playerX, state.playerY - state.playerZ, CONFIG.colors.purple, 0.25);
    }

    if (state.smokeBombTimer > 0 && chance(0.45)) {
      addSmoke(state.playerX + rand(-24, 24), state.playerY + rand(10, 56), 1);
    }
  }

  function spawnPattern() {
    const lanes = [0, 1, 2];
    const pattern = Math.floor(rand(0, 10));

    if (pattern === 0) {
      spawnObject("op", lanes[Math.floor(rand(0, 3))]);
      spawnObject("cash", lanes[Math.floor(rand(0, 3))], -120);
    } else if (pattern === 1) {
      lanes.forEach((lane) => spawnObject(lane === 1 ? "blockade" : "coin", lane, rand(-40, 80)));
    } else if (pattern === 2) {
      spawnObject("package", 0, 0);
      spawnObject("cash", 1, -90);
      spawnObject("package", 2, -180);
    } else if (pattern === 3) {
      spawnObject("traffic", lanes[Math.floor(rand(0, 3))]);
      spawnObject("coin", lanes[Math.floor(rand(0, 3))], -120);
    } else if (pattern === 4) {
      spawnObject("ramp", lanes[Math.floor(rand(0, 3))]);
      spawnObject("gem", lanes[Math.floor(rand(0, 3))], -150);
    } else if (pattern === 5) {
      lanes.forEach((lane) => spawnObject("coin", lane, lane * -55));
    } else if (pattern === 6) {
      spawnObject("drone", lanes[Math.floor(rand(0, 3))]);
    } else if (pattern === 7) {
      spawnObject("smokeWall", lanes[Math.floor(rand(0, 3))]);
      spawnObject("cash", lanes[Math.floor(rand(0, 3))], -160);
    } else if (pattern === 8) {
      lanes.forEach((lane) => spawnObject(lane === 0 ? "cash" : "op", lane, lane * -72));
    } else {
      spawnObject("op", lanes[Math.floor(rand(0, 3))]);
    }

    if (chance(0.18)) {
      spawnObject("powerup", lanes[Math.floor(rand(0, 3))], rand(-180, -30));
    }

    if (chance(0.08)) {
      spawnObject("gem", lanes[Math.floor(rand(0, 3))], rand(-200, -70));
    }
  }

  function spawnObject(type, lane, offset = 0) {
    const powerTypes = Object.keys(POWERUPS);
    const power = type === "powerup" ? powerTypes[Math.floor(rand(0, powerTypes.length))] : null;

    state.objects.push({
      id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
      type,
      power,
      lane,
      x: laneX(lane),
      y: -95 + offset,
      w: ["blockade", "traffic"].includes(type) ? 94 : 62,
      h: ["blockade", "traffic"].includes(type) ? 66 : 62,
      rot: rand(-0.22, 0.22),
      spin: rand(-0.045, 0.045),
      scale: rand(0.9, 1.1),
      bob: rand(0, Math.PI * 2)
    });
  }

  function updateObjects(dt, slowFactor) {
    const speed = state.speed * slowFactor;

    for (let i = state.objects.length - 1; i >= 0; i -= 1) {
      const obj = state.objects[i];

      obj.y += speed * (dt / 16.67);
      obj.rot += obj.spin * (dt / 16.67);

      if (state.magnetTimer > 0 && ["coin", "cash", "gem", "package", "powerup"].includes(obj.type)) {
        const dx = state.playerX - obj.x;
        const dy = state.playerY - state.playerZ - obj.y;

        if (Math.hypot(dx, dy) < 230) {
          obj.x += dx * 0.085;
          obj.y += dy * 0.085;
        }
      }

      if (collides(obj)) {
        handleCollision(obj);
        state.objects.splice(i, 1);
        continue;
      }

      if (obj.y > state.h + 120) {
        state.objects.splice(i, 1);
      }
    }
  }

  function collides(obj) {
    const px = state.playerX;
    const py = state.playerY - state.playerZ + (state.sliding ? 18 : 0);
    const pw = state.sliding ? 60 : 54;
    const ph = state.sliding ? 48 : 84;

    const ow = obj.w * obj.scale;
    const oh = obj.h * obj.scale;

    return (
      Math.abs(px - obj.x) < (pw + ow) * 0.5 &&
      Math.abs(py - obj.y) < (ph + oh) * 0.5
    );
  }

  function handleCollision(obj) {
    if (obj.type === "coin") {
      collect(CONFIG.coinValue, "COIN", CONFIG.colors.gold);
      burst(obj.x, obj.y, CONFIG.colors.gold, 12, 1);
      return;
    }

    if (obj.type === "cash") {
      collect(CONFIG.cashValue, "CASH", CONFIG.colors.green);
      burst(obj.x, obj.y, CONFIG.colors.green, 18, 1.35);
      return;
    }

    if (obj.type === "package") {
      collect(CONFIG.packageValue, "PACK", CONFIG.colors.blue);
      burst(obj.x, obj.y, CONFIG.colors.blue, 18, 1.4);
      return;
    }

    if (obj.type === "gem") {
      collect(CONFIG.gemValue, "GEM", CONFIG.colors.purple);
      burst(obj.x, obj.y, CONFIG.colors.purple, 22, 1.55);
      return;
    }

    if (obj.type === "powerup") {
      activatePower(obj.power);
      burst(obj.x, obj.y, POWERUPS[obj.power]?.color || CONFIG.colors.green, 26, 1.7);
      return;
    }

    if (obj.type === "ramp") {
      jump();
      floatingText("ROOF JUMP", obj.x, obj.y, CONFIG.colors.blue);
      return;
    }

    if (state.invincibleTimer > 0 || state.shieldTimer > 0 || state.smokeBombTimer > 0) {
      state.shake = 0.72;
      state.flash = 0.25;

      const label = state.smokeBombTimer > 0 ? "LOST IN SMOKE" : "BLOCKED";
      const color = state.smokeBombTimer > 0 ? CONFIG.colors.green : CONFIG.colors.blue;

      floatingText(label, obj.x, obj.y, color);
      burst(obj.x, obj.y, color, 24, 1.7);
      addSmoke(obj.x, obj.y, 2.5);

      if (state.shieldTimer > 0) {
        state.shieldTimer = Math.max(0, state.shieldTimer - 1550);
      }

      return;
    }

    damage(obj);
  }

  function collect(value, label, color) {
    const gain = Math.floor(value * state.combo);

    if (label === "GEM") {
      state.gems += 1;
    } else {
      state.cash += gain;
    }

    state.score += gain * 4;
    state.xp += Math.max(6, Math.floor(gain / 2));
    state.combo = clamp(state.combo + 0.18, 1, 9);
    state.comboTimer = 2700;

    floatingText(`+${gain} ${label}`, state.playerX, state.playerY - 80, color);
    updateLevelFromXp();
  }

  function activatePower(power) {
    if (power === "shield") state.shieldTimer = CONFIG.shieldMs;
    if (power === "magnet") state.magnetTimer = CONFIG.magnetMs;
    if (power === "boost") state.boostTimer = CONFIG.boostMs;
    if (power === "smoke") state.smokeBombTimer = CONFIG.smokeBombMs;
    if (power === "slowmo") state.slowmoTimer = CONFIG.slowMoMs;

    state.score += 275;
    state.xp += 50;
    state.combo = clamp(state.combo + 0.42, 1, 9);
    state.comboTimer = 3200;

    floatingText(`${POWERUPS[power]?.label || "POWER"}!`, state.playerX, state.playerY - 120, POWERUPS[power]?.color || CONFIG.colors.green);
    updateLevelFromXp();
  }

  function damage(obj) {
    state.shake = 1;
    state.flash = 1;
    state.gameOver = true;
    state.running = false;

    const finalScore = Math.floor(state.score + state.distance);
    state.highScore = Math.max(state.highScore, finalScore);
    state.totalCash += state.cash;
    state.xp += Math.floor(finalScore / 40);
    updateLevelFromXp();
    saveGame();

    burst(obj.x, obj.y, CONFIG.colors.red, 38, 2.4);
    addSmoke(obj.x, obj.y, 3.2);
    floatingText("CAUGHT UP", state.w / 2, state.h * 0.38, CONFIG.colors.red);

    window.dispatchEvent(
      new CustomEvent("rb:game-run-complete", {
        detail: {
          game: GAME_ID,
          score: finalScore,
          cash: state.cash,
          gems: state.gems,
          distance: Math.floor(state.distance),
          xp: state.xp,
          level: state.level,
          rank: state.rank
        }
      })
    );
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];

      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.life -= dt;
      p.vy += p.gravity * (dt / 16.67);
      p.rot += p.spin;

      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    for (let i = state.smoke.length - 1; i >= 0; i -= 1) {
      const s = state.smoke[i];

      s.x += s.vx * (dt / 16.67);
      s.y += s.vy * (dt / 16.67);
      s.r += s.grow * (dt / 16.67);
      s.life -= dt;

      if (s.life <= 0) {
        state.smoke.splice(i, 1);
      }
    }
  }

  function updateTexts(dt) {
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];

      text.y += text.vy * (dt / 16.67);
      text.life -= dt;
      text.scale += 0.002 * (dt / 16.67);

      if (text.life <= 0) {
        state.texts.splice(i, 1);
      }
    }
  }

  function updateWorld(dt, slowFactor) {
    const speed = state.speed * slowFactor;

    state.roadLines.forEach((line) => {
      line.y += speed * 1.5 * (dt / 16.67);

      if (line.y > state.h + 40) {
        line.y = -40;
      }
    });

    state.buildings.forEach((b) => {
      b.y += speed * 0.82 * (dt / 16.67);

      if (b.y > state.h + 300) {
        b.y = rand(-430, -90);
        b.w = rand(34, 82);
        b.h = rand(100, 310);
        b.glow = rand(0.2, 0.85);
        b.windowColor = chance(0.5) ? "#66ff99" : "#ffd86b";
      }
    });

    state.neonSigns.forEach((sign) => {
      sign.y += speed * 0.95 * (dt / 16.67);

      if (sign.y > state.h + 90) {
        sign.y = rand(-420, -110);
        sign.text = ["SMOKE", "CITY", "RICH", "BIZ", "OPEN", "TRAP", "RUN"][Math.floor(rand(0, 7))];
        sign.color = ["#66ff99", "#ffd86b", "#38bdf8", "#a855f7"][Math.floor(rand(0, 4))];
      }
    });

    if (chance(0.18)) {
      addSmoke(rand(0, state.w), state.h + 30, rand(0.4, 1.25));
    }
  }

  function burst(x, y, color, count = 12, force = 1) {
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1.2, 5.2) * force;

      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(2, 6) * force,
        color,
        life: rand(320, 780),
        gravity: rand(0.02, 0.08),
        rot: rand(0, Math.PI),
        spin: rand(-0.08, 0.08)
      });
    }
  }

  function addTrail(x, y, color, alpha = 0.55) {
    state.particles.push({
      x: x + rand(-18, 18),
      y: y + rand(18, 48),
      vx: rand(-0.4, 0.4),
      vy: rand(1, 3),
      r: rand(4, 12),
      color,
      alpha,
      life: rand(180, 360),
      gravity: -0.01,
      rot: 0,
      spin: 0
    });
  }

  function addSmoke(x, y, power = 1) {
    state.smoke.push({
      x,
      y,
      vx: rand(-0.28, 0.28),
      vy: rand(-1.5, -0.35),
      r: rand(18, 54) * power,
      grow: rand(0.08, 0.3) * power,
      life: rand(900, 1900),
      alpha: rand(0.035, 0.12)
    });
  }

  function floatingText(text, x, y, color = CONFIG.colors.gold) {
    state.texts.push({
      text,
      x,
      y,
      color,
      vy: -1.35,
      life: 950,
      scale: 1
    });
  }

  function draw(time) {
    const ctx = state.ctx;
    const w = state.w;
    const h = state.h;

    const sx = state.shake ? rand(-8, 8) * state.shake : 0;
    const sy = state.shake ? rand(-8, 8) * state.shake : 0;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(sx, sy);

    drawBackground(ctx, w, h, time);
    drawRoad(ctx, w, h, time);
    drawObjects(ctx, time);
    drawPlayer(ctx, time);
    drawParticles(ctx);
    drawHUD(ctx, w, h);
    drawOverlay(ctx, w, h);

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.32})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    ctx.restore();
  }

  function drawBackground(ctx, w, h, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#072611");
    g.addColorStop(0.42, "#020604");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (state.imageReady.smokeCity) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      coverImage(ctx, state.images.smokeCity, 0, 0, w, h);
      ctx.restore();
    } else if (state.imageReady.gaming) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      coverImage(ctx, state.images.gaming, 0, 0, w, h);
      ctx.restore();
    }

    state.stars.forEach((star) => {
      const twinkle = 0.45 + Math.sin(time * 0.002 + star.p) * 0.35;
      ctx.fillStyle = `rgba(255,255,255,${star.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h * 0.62, star.s, 0, Math.PI * 2);
      ctx.fill();
    });

    state.buildings.forEach((b) => {
      const bw = b.w;
      const bh = b.h;
      const x = b.side < 0 ? 12 : w - bw - 12;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, x, b.y, bw, bh, 10);
      ctx.fill();

      ctx.fillStyle = hexToRgba(b.windowColor, 0.06 + b.glow * 0.08);
      for (let wy = b.y + 14; wy < b.y + bh - 12; wy += 22) {
        for (let wx = x + 10; wx < x + bw - 10; wx += 18) {
          ctx.fillRect(wx, wy, 5, 8);
        }
      }
    });

    state.neonSigns.forEach((sign) => {
      const x = sign.side < 0 ? 18 : w - 84;

      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, x, sign.y, 66, 26, 8);
      ctx.fill();

      ctx.strokeStyle = sign.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = sign.color;
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.fillStyle = sign.color;
      ctx.font = "1000 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sign.text, x + 33, sign.y + 13);
      ctx.restore();
    });

    state.smoke.forEach((s) => {
      const alpha = Math.max(0, s.life / 1900) * s.alpha;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grad.addColorStop(0, `rgba(102,255,153,${alpha})`);
      grad.addColorStop(0.45, `rgba(255,216,107,${alpha * 0.22})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRoad(ctx, w, h, time) {
    const topW = w * 0.26;
    const bottomW = w * 0.94;
    const cx = w / 2;

    const road = ctx.createLinearGradient(0, 88, 0, h);
    road.addColorStop(0, "rgba(4,22,10,0.9)");
    road.addColorStop(1, "rgba(0,0,0,0.96)");

    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, 90);
    ctx.lineTo(cx + topW / 2, 90);
    ctx.lineTo(cx + bottomW / 2, h + 30);
    ctx.lineTo(cx - bottomW / 2, h + 30);
    ctx.closePath();
    ctx.fillStyle = road;
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.28)";
    ctx.lineWidth = 3;
    ctx.stroke();

    const laneGapTop = topW / 3;
    const laneGapBottom = bottomW / 3;

    for (let i = 1; i < 3; i += 1) {
      const xTop = cx - topW / 2 + laneGapTop * i;
      const xBottom = cx - bottomW / 2 + laneGapBottom * i;

      ctx.strokeStyle = "rgba(102,255,153,0.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([24, 24]);
      ctx.beginPath();
      ctx.moveTo(xTop, 90);
      ctx.lineTo(xBottom, h + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    state.roadLines.forEach((line) => {
      const p = line.y / h;
      const y = lerp(90, h, p);
      const width = lerp(topW * 0.16, bottomW * 0.24, p);

      ctx.globalAlpha = line.a * 0.55;
      ctx.fillStyle = "rgba(250,204,21,0.28)";
      roundRect(ctx, cx - width / 2, y, width, 5, 999);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawObjects(ctx, time) {
    state.objects.forEach((obj) => {
      ctx.save();

      const bob = Math.sin(time * 0.004 + obj.bob) * 4;
      ctx.translate(obj.x, obj.y + bob);
      ctx.rotate(obj.rot);
      ctx.scale(obj.scale, obj.scale);

      if (obj.type === "coin") drawCoin(ctx);
      if (obj.type === "cash") drawCash(ctx);
      if (obj.type === "package") drawPackage(ctx);
      if (obj.type === "gem") drawGem(ctx);
      if (obj.type === "powerup") drawPowerup(ctx, obj.power);
      if (obj.type === "op") drawOp(ctx);
      if (obj.type === "traffic") drawTraffic(ctx);
      if (obj.type === "blockade") drawBlockade(ctx);
      if (obj.type === "drone") drawDrone(ctx);
      if (obj.type === "smokeWall") drawSmokeWall(ctx);
      if (obj.type === "ramp") drawRamp(ctx);

      ctx.restore();
    });
  }

  function drawCoin(ctx) {
    ctx.fillStyle = CONFIG.colors.gold;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#041006";
    ctx.font = "900 24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
  }

  function drawCash(ctx) {
    ctx.fillStyle = CONFIG.colors.green;
    roundRect(ctx, -34, -20, 68, 40, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(4,16,6,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#041006";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RB", 0, 2);
  }

  function drawPackage(ctx) {
    ctx.fillStyle = "#8b5a2b";
    roundRect(ctx, -30, -28, 60, 56, 12);
    ctx.fill();

    ctx.strokeStyle = CONFIG.colors.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-30, -2);
    ctx.lineTo(30, -2);
    ctx.moveTo(0, -28);
    ctx.lineTo(0, 28);
    ctx.stroke();
  }

  function drawGem(ctx) {
    ctx.fillStyle = CONFIG.colors.purple;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(30, -5);
    ctx.lineTo(0, 34);
    ctx.lineTo(-30, -5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawPowerup(ctx, power) {
    const data = POWERUPS[power] || POWERUPS.shield;

    ctx.fillStyle = data.color;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = "900 25px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.icon, 0, 1);
  }

  function drawOp(ctx) {
    ctx.fillStyle = CONFIG.colors.red;
    roundRect(ctx, -30, -32, 60, 64, 18);
    ctx.fill();

    ctx.fillStyle = "#020402";
    ctx.fillRect(-18, -8, 12, 10);
    ctx.fillRect(6, -8, 12, 10);

    ctx.strokeStyle = "#020402";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, 14);
    ctx.lineTo(14, 14);
    ctx.stroke();
  }

  function drawTraffic(ctx) {
    ctx.fillStyle = "#111827";
    roundRect(ctx, -44, -30, 88, 60, 18);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.fillRect(-34, -12, 68, 10);
    ctx.fillStyle = CONFIG.colors.red;
    ctx.fillRect(-30, 12, 60, 8);
  }

  function drawBlockade(ctx) {
    ctx.fillStyle = "#111827";
    roundRect(ctx, -48, -28, 96, 56, 14);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.gold;
    for (let i = -42; i < 42; i += 24) {
      ctx.save();
      ctx.translate(i, 0);
      ctx.rotate(-0.7);
      ctx.fillRect(-5, -34, 10, 68);
      ctx.restore();
    }
  }

  function drawDrone(ctx) {
    ctx.fillStyle = "#020617";
    roundRect(ctx, -30, -16, 60, 32, 14);
    ctx.fill();

    ctx.strokeStyle = CONFIG.colors.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.lineTo(46, 0);
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.red;
    ctx.beginPath();
    ctx.arc(-48, 0, 10, 0, Math.PI * 2);
    ctx.arc(48, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.blue;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSmokeWall(ctx) {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 58);
    grad.addColorStop(0, "rgba(102,255,153,0.38)");
    grad.addColorStop(0.5, "rgba(255,216,107,0.12)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💨", 0, 0);
  }

  function drawRamp(ctx) {
    ctx.fillStyle = CONFIG.colors.blue;
    ctx.beginPath();
    ctx.moveTo(-42, 30);
    ctx.lineTo(42, 30);
    ctx.lineTo(22, -26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.48)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawPlayer(ctx, time) {
    const x = state.playerX;
    const y = state.playerY - state.playerZ;
    const bob = Math.sin(time * 0.012) * (state.jumping ? 1 : 3);
    const lean = state.playerLean * 0.18;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(lean);

    if (state.shieldTimer > 0) {
      ctx.strokeStyle = `rgba(56,189,248,${0.45 + Math.sin(time * 0.012) * 0.22})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -10, 54, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.magnetTimer > 0) {
      ctx.strokeStyle = `rgba(168,85,247,${0.32 + Math.sin(time * 0.01) * 0.16})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -10, 82, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.smokeBombTimer > 0) {
      ctx.strokeStyle = `rgba(102,255,153,${0.3 + Math.sin(time * 0.018) * 0.12})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -10, 66, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bodyH = state.sliding ? 38 : 70;
    const bodyY = state.sliding ? 8 : -10;

    const hoodie = ctx.createLinearGradient(-26, -50, 26, 28);
    hoodie.addColorStop(0, "#064e2b");
    hoodie.addColorStop(0.48, "#020402");
    hoodie.addColorStop(1, "#111827");
    ctx.fillStyle = hoodie;
    roundRect(ctx, -28, bodyY - bodyH / 2, 56, bodyH, 18);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RB", 0, bodyY - 6);

    ctx.fillStyle = "#d89a78";
    ctx.beginPath();
    ctx.arc(0, -58, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#020402";
    roundRect(ctx, -26, -76, 52, 16, 8);
    ctx.fill();

    ctx.fillStyle = "#050505";
    roundRect(ctx, -22, -62, 44, 8, 999);
    ctx.fill();

    ctx.strokeStyle = CONFIG.colors.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -20, 25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.beginPath();
    ctx.arc(0, 5, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(102,255,153,0.9)";
    ctx.font = "900 18px system-ui";
    ctx.fillText("💨", 30, -46);

    if (state.dashing) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = CONFIG.colors.gold;
      roundRect(ctx, -44, -18, 88, 50, 20);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawParticles(ctx) {
    state.particles.forEach((p) => {
      const alpha = Math.max(0, p.life / 780) * (p.alpha ?? 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    state.texts.forEach((text) => {
      const alpha = Math.max(0, text.life / 950);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(text.x, text.y);
      ctx.scale(text.scale, text.scale);
      ctx.fillStyle = text.color;
      ctx.font = "1000 24px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = text.color;
      ctx.shadowBlur = 18;
      ctx.fillText(text.text, 0, 0);
      ctx.restore();
    });
  }

  function drawHUD(ctx, w, h) {
    const finalScore = Math.floor(state.score + state.distance);

    drawPill(ctx, 16, 18, `SCORE ${finalScore.toLocaleString()}`, CONFIG.colors.gold);
    drawPill(ctx, 16, 62, `CASH ${state.cash.toLocaleString()}`, CONFIG.colors.green);
    drawPill(ctx, w - 156, 18, `LVL ${state.level}`, CONFIG.colors.blue);
    drawPill(ctx, w - 156, 62, `x${state.combo.toFixed(1)}`, CONFIG.colors.purple);

    let x = 16;
    const y = 108;

    if (state.shieldTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERUPS.shield.icon, state.shieldTimer / CONFIG.shieldMs, POWERUPS.shield.color);
      x += 54;
    }

    if (state.magnetTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERUPS.magnet.icon, state.magnetTimer / CONFIG.magnetMs, POWERUPS.magnet.color);
      x += 54;
    }

    if (state.boostTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERUPS.boost.icon, state.boostTimer / CONFIG.boostMs, POWERUPS.boost.color);
      x += 54;
    }

    if (state.smokeBombTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERUPS.smoke.icon, state.smokeBombTimer / CONFIG.smokeBombMs, POWERUPS.smoke.color);
      x += 54;
    }

    if (state.slowmoTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERUPS.slowmo.icon, state.slowmoTimer / CONFIG.slowMoMs, POWERUPS.slowmo.color);
    }
  }

  function drawOverlay(ctx, w, h) {
    if (!state.running && !state.gameOver) {
      drawStartOverlay(ctx, w, h);
    }

    if (state.paused && state.running) {
      drawCenterBox(ctx, w, h, "PAUSED", "Tap Enter / P to resume");
    }

    if (state.gameOver) {
      drawCenterBox(
        ctx,
        w,
        h,
        "CAUGHT UP",
        `Score ${Math.floor(state.score + state.distance).toLocaleString()} • High ${state.highScore.toLocaleString()} • Press R`
      );
    }
  }

  function drawStartOverlay(ctx, w, h) {
    ctx.save();

    const boxW = Math.min(352, w - 32);
    const boxH = 230;
    const x = (w - boxW) / 2;
    const y = h * 0.32;

    ctx.fillStyle = "rgba(0,0,0,0.66)";
    roundRect(ctx, x, y, boxW, boxH, 30);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.32)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.green;
    ctx.font = "1000 34px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("SMOKE CITY", w / 2, y + 58);

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.font = "1000 22px system-ui";
    ctx.fillText("HUSTLE", w / 2, y + 91);

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "800 14px system-ui";
    ctx.fillText("Swipe • Arrows • WASD", w / 2, y + 132);
    ctx.fillText("Dodge ops, grab packs, stack XP", w / 2, y + 156);

    ctx.fillStyle = CONFIG.colors.green;
    roundRect(ctx, w / 2 - 108, y + 178, 216, 34, 999);
    ctx.fill();

    ctx.fillStyle = "#041006";
    ctx.font = "1000 13px system-ui";
    ctx.fillText("TAP TO HUSTLE", w / 2, y + 200);

    ctx.restore();
  }

  function drawCenterBox(ctx, w, h, title, subtitle) {
    ctx.save();

    const boxW = Math.min(370, w - 32);
    const boxH = 186;
    const x = (w - boxW) / 2;
    const y = h * 0.36;

    ctx.fillStyle = "rgba(0,0,0,0.74)";
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.34)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = title === "CAUGHT UP" ? CONFIG.colors.red : CONFIG.colors.gold;
    ctx.font = "1000 38px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, y + 72);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 14px system-ui";
    wrapText(ctx, subtitle, w / 2, y + 112, boxW - 42, 20);

    ctx.restore();
  }

  function drawPill(ctx, x, y, text, color) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    roundRect(ctx, x, y, 140, 34, 999);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.38;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.font = "1000 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 70, y + 17);

    ctx.restore();
  }

  function drawPowerBadge(ctx, x, y, icon, pct, color) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.beginPath();
    ctx.arc(x + 22, y + 22, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 22, y + 22, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pct, 0, 1));
    ctx.stroke();

    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x + 22, y + 23);

    ctx.restore();
  }

  function coverImage(ctx, img, x, y, w, h) {
    const iw = img.width;
    const ih = img.height;
    const r = Math.max(w / iw, h / ih);
    const nw = iw * r;
    const nh = ih * r;
    const nx = x + (w - nw) / 2;
    const ny = y + (h - nh) / 2;

    ctx.drawImage(img, nx, ny, nw, nh);
  }

  function roundRect(ctx, x, y, w, h, r = 12) {
    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(" ");
    let line = "";
    let cy = y;

    words.forEach((word) => {
      const testLine = `${line}${word} `;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = `${word} `;
        cy += lineHeight;
      } else {
        line = testLine;
      }
    });

    ctx.fillText(line, x, cy);
  }

  function hexToRgba(hex, alpha = 1) {
    const clean = String(hex).replace("#", "");
    const bigint = Number.parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r},${g},${b},${alpha})`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
