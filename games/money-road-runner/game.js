/* =========================
   RICH BIZNESS MOBILE
   /games/money-road-runner/game.js

   MONEY ROAD RUNNER
   Full Extreme One-File Canvas Game
   Mobile + Desktop Controls
   No External Dependencies
========================= */

(() => {
  "use strict";

  const GAME_ID = "money-road-runner";
  const STORAGE_KEY = "rb_money_road_runner_save_v1";

  const CONFIG = Object.freeze({
    title: "Money Road Runner",
    brand: "Rich Bizness LLC",
    route: "/gaming.html",

    width: 390,
    height: 844,

    lanes: 3,
    lanePadding: 54,

    roadTop: 92,
    roadBottom: 844,

    playerY: 690,

    gravity: 0.8,
    jumpPower: -17.5,
    dashTime: 240,

    baseSpeed: 6.2,
    maxSpeed: 18.5,
    speedRamp: 0.00072,

    spawnBaseMs: 720,
    spawnMinMs: 285,

    coinValue: 10,
    gemValue: 65,
    cashValue: 25,

    shieldMs: 6200,
    magnetMs: 6200,
    boostMs: 5200,

    slowMoMs: 2600,

    colors: {
      black: "#020402",
      green: "#66ff99",
      green2: "#00ff88",
      emerald: "#10b981",
      gold: "#ffd86b",
      gold2: "#facc15",
      red: "#ff3355",
      blue: "#38bdf8",
      purple: "#a855f7",
      white: "#ffffff"
    }
  });

  const ASSETS = Object.freeze({
    hero: "/images/brand/hero-banner.png",
    avatar: "/images/brand/Avatar-hero-Banner.png.jpeg",
    gaming: "/images/brand/gaming-hero.png.jpeg"
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
    slowmo: {
      label: "SLOW",
      icon: "🌀",
      color: "#66ff99"
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

    w: CONFIG.width,
    h: CONFIG.height,
    scale: 1,

    lastTime: 0,
    elapsed: 0,
    shake: 0,
    flash: 0,

    score: 0,
    coins: 0,
    gems: 0,
    distance: 0,
    combo: 1,
    comboTimer: 0,

    level: 1,
    xp: 0,
    rank: "Street Runner",

    highScore: 0,
    totalCoins: 0,
    totalRuns: 0,

    speed: CONFIG.baseSpeed,
    spawnTimer: 0,
    spawnEvery: CONFIG.spawnBaseMs,

    lane: 1,
    targetLane: 1,

    playerX: 0,
    playerVX: 0,
    playerY: CONFIG.playerY,
    playerZ: 0,
    playerVY: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    dashing: false,
    dashTimer: 0,
    invincibleTimer: 0,

    shieldTimer: 0,
    magnetTimer: 0,
    boostTimer: 0,
    slowmoTimer: 0,

    objects: [],
    particles: [],
    texts: [],
    stars: [],
    smoke: [],
    roadLines: [],
    buildings: [],

    input: {
      left: false,
      right: false,
      up: false,
      down: false,
      pointerDown: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0
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
      state.totalCoins = Number(save.totalCoins || 0);
      state.totalRuns = Number(save.totalRuns || 0);
      state.xp = Number(save.xp || 0);
      state.level = Number(save.level || 1);
      state.rank = save.rank || getRank(state.level);
    } catch {
      state.highScore = 0;
      state.totalCoins = 0;
      state.totalRuns = 0;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          highScore: state.highScore,
          totalCoins: state.totalCoins,
          totalRuns: state.totalRuns,
          xp: state.xp,
          level: state.level,
          rank: state.rank
        })
      );
    } catch {
      /* storage can fail on private mode */
    }
  }

  function getRank(level) {
    if (level >= 50) return "Money Road Legend";
    if (level >= 35) return "Highway Boss";
    if (level >= 25) return "Green Lane Elite";
    if (level >= 15) return "Rich Runner";
    if (level >= 8) return "Fast Hustler";
    return "Street Runner";
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
    const existing = qs("#moneyRoadRunnerCanvas") || qs("canvas[data-money-road-runner]");
    const container =
      qs("#money-road-runner") ||
      qs("[data-game='money-road-runner']") ||
      qs(".money-road-runner") ||
      document.body;

    const canvas = existing || document.createElement("canvas");

    canvas.id = canvas.id || "moneyRoadRunnerCanvas";
    canvas.dataset.moneyRoadRunner = "true";
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
    state.stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: rand(0.4, 2.2),
      a: rand(0.2, 0.9),
      p: rand(0, Math.PI * 2)
    }));

    state.roadLines = Array.from({ length: 24 }, (_, i) => ({
      y: (i / 24) * state.h,
      a: rand(0.45, 0.95)
    }));

    state.buildings = Array.from({ length: 26 }, (_, i) => ({
      side: i % 2 === 0 ? -1 : 1,
      y: rand(-state.h, state.h),
      w: rand(34, 76),
      h: rand(90, 270),
      glow: rand(0.2, 0.72)
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

    window.RB_MONEY_ROAD_RUNNER = {
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

    state.playerY = state.h * 0.78;
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
    state.coins = 0;
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
    state.playerVX = 0;
    state.playerZ = 0;
    state.playerVY = 0;
    state.jumping = false;
    state.sliding = false;
    state.slideTimer = 0;
    state.dashing = false;
    state.dashTimer = 0;
    state.invincibleTimer = 1200;
    state.shieldTimer = 0;
    state.magnetTimer = 0;
    state.boostTimer = 0;
    state.slowmoTimer = 0;
    state.objects.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;

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

    burst(state.playerX, state.playerY, "#66ff99", 22, 1.8);
    floatingText("RUN IT UP", state.w / 2, state.h * 0.38, "#ffd86b");
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
    state.totalCoins = 0;
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
    state.input.lastX = event.clientX;
    state.input.lastY = event.clientY;

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

    state.input.lastX = event.clientX;
    state.input.lastY = event.clientY;
  }

  function onPointerUp() {
    state.input.pointerDown = false;
  }

  function moveLane(dir) {
    if (state.gameOver) return;

    state.targetLane = clamp(state.targetLane + dir, 0, CONFIG.lanes - 1);
    state.lane = state.targetLane;
    burst(laneX(state.lane), state.playerY + 30, "#66ff99", 8, 1);
  }

  function jump() {
    if (state.gameOver || state.jumping) return;

    state.jumping = true;
    state.playerVY = CONFIG.jumpPower;
    burst(state.playerX, state.playerY + 44, "#ffd86b", 14, 1.2);
  }

  function slide() {
    if (state.gameOver || state.sliding) return;

    state.sliding = true;
    state.slideTimer = 520;
    burst(state.playerX, state.playerY + 52, "#38bdf8", 12, 1);
  }

  function dash() {
    if (state.gameOver || state.dashing) return;

    state.dashing = true;
    state.dashTimer = CONFIG.dashTime;
    state.invincibleTimer = Math.max(state.invincibleTimer, CONFIG.dashTime + 120);
    state.flash = 0.7;
    burst(state.playerX, state.playerY + 16, "#facc15", 28, 2.1);
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

    state.elapsed += dt;
    state.speed = clamp(CONFIG.baseSpeed + state.elapsed * CONFIG.speedRamp, CONFIG.baseSpeed, CONFIG.maxSpeed) * boostFactor;
    state.distance += state.speed * dt * 0.012 * slowFactor;
    state.score += Math.floor(state.speed * dt * 0.025 * state.combo);

    state.spawnEvery = clamp(CONFIG.spawnBaseMs - state.elapsed * 0.028, CONFIG.spawnMinMs, CONFIG.spawnBaseMs);
    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0) {
      spawnPattern();
      state.spawnTimer = state.spawnEvery * rand(0.72, 1.24);
    }

    updateTimers(dt);
    updatePlayer(dt);
    updateObjects(dt, slowFactor);
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt, slowFactor);
    updateCombo(dt);
  }

  function updateIdle(dt, time) {
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt, 0.6);

    if (!state.running && chance(0.02)) {
      addSmoke(rand(0, state.w), state.h + 10, rand(0.3, 1));
    }
  }

  function updateTimers(dt) {
    state.shake = Math.max(0, state.shake - dt * 0.004);
    state.flash = Math.max(0, state.flash - dt * 0.004);

    state.shieldTimer = Math.max(0, state.shieldTimer - dt);
    state.magnetTimer = Math.max(0, state.magnetTimer - dt);
    state.boostTimer = Math.max(0, state.boostTimer - dt);
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
      state.combo = Math.max(1, state.combo - 0.02);
    }
  }

  function updatePlayer(dt) {
    const targetX = laneX(state.lane);
    state.playerX = lerp(state.playerX, targetX, 0.22);

    if (state.jumping) {
      state.playerZ += state.playerVY;
      state.playerVY += CONFIG.gravity;

      if (state.playerZ >= 0) {
        state.playerZ = 0;
        state.playerVY = 0;
        state.jumping = false;
        burst(state.playerX, state.playerY + 50, "#66ff99", 10, 1);
      }
    }

    if (state.dashing) {
      addTrail(state.playerX, state.playerY - state.playerZ, "#ffd86b");
    }

    if (state.shieldTimer > 0) {
      addTrail(state.playerX, state.playerY - state.playerZ, "#38bdf8", 0.35);
    }

    if (state.magnetTimer > 0) {
      addTrail(state.playerX, state.playerY - state.playerZ, "#a855f7", 0.25);
    }
  }

  function spawnPattern() {
    const lanes = [0, 1, 2];
    const pattern = Math.floor(rand(0, 8));

    if (pattern === 0) {
      spawnObject("obstacle", lanes[Math.floor(rand(0, 3))]);
      spawnObject("coin", lanes[Math.floor(rand(0, 3))], -120);
    } else if (pattern === 1) {
      lanes.forEach((lane) => spawnObject(lane === 1 ? "obstacle" : "coin", lane, rand(-40, 80)));
    } else if (pattern === 2) {
      spawnObject("cash", 0, 0);
      spawnObject("cash", 1, -90);
      spawnObject("cash", 2, -180);
    } else if (pattern === 3) {
      spawnObject("barrier", lanes[Math.floor(rand(0, 3))]);
      spawnObject("coin", lanes[Math.floor(rand(0, 3))], -120);
    } else if (pattern === 4) {
      spawnObject("ramp", lanes[Math.floor(rand(0, 3))]);
      spawnObject("gem", lanes[Math.floor(rand(0, 3))], -150);
    } else if (pattern === 5) {
      lanes.forEach((lane) => spawnObject("coin", lane, lane * -55));
    } else if (pattern === 6) {
      spawnObject("enemy", lanes[Math.floor(rand(0, 3))]);
    } else {
      spawnObject("obstacle", lanes[Math.floor(rand(0, 3))]);
    }

    if (chance(0.16)) {
      spawnObject("powerup", lanes[Math.floor(rand(0, 3))], rand(-150, -30));
    }

    if (chance(0.08)) {
      spawnObject("gem", lanes[Math.floor(rand(0, 3))], rand(-180, -60));
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
      y: -90 + offset,
      w: type === "barrier" ? 92 : 62,
      h: type === "barrier" ? 62 : 62,
      rot: rand(-0.2, 0.2),
      spin: rand(-0.04, 0.04),
      hit: false,
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

      if (state.magnetTimer > 0 && ["coin", "gem", "cash", "powerup"].includes(obj.type)) {
        const dx = state.playerX - obj.x;
        const dy = state.playerY - state.playerZ - obj.y;

        if (Math.hypot(dx, dy) < 220) {
          obj.x += dx * 0.08;
          obj.y += dy * 0.08;
        }
      }

      if (collides(obj)) {
        handleCollision(obj);
        state.objects.splice(i, 1);
        continue;
      }

      if (obj.y > state.h + 110) {
        state.objects.splice(i, 1);
      }
    }
  }

  function collides(obj) {
    const px = state.playerX;
    const py = state.playerY - state.playerZ + (state.sliding ? 18 : 0);
    const pw = state.sliding ? 58 : 54;
    const ph = state.sliding ? 48 : 82;

    const ow = obj.w * obj.scale;
    const oh = obj.h * obj.scale;

    return (
      Math.abs(px - obj.x) < (pw + ow) * 0.5 &&
      Math.abs(py - obj.y) < (ph + oh) * 0.5
    );
  }

  function handleCollision(obj) {
    if (obj.type === "coin") {
      collect(CONFIG.coinValue, "COIN", "#ffd86b");
      burst(obj.x, obj.y, "#ffd86b", 12, 1);
      return;
    }

    if (obj.type === "cash") {
      collect(CONFIG.cashValue, "CASH", "#66ff99");
      burst(obj.x, obj.y, "#66ff99", 18, 1.35);
      return;
    }

    if (obj.type === "gem") {
      collect(CONFIG.gemValue, "GEM", "#a855f7");
      burst(obj.x, obj.y, "#a855f7", 20, 1.55);
      return;
    }

    if (obj.type === "powerup") {
      activatePower(obj.power);
      burst(obj.x, obj.y, POWERUPS[obj.power]?.color || "#66ff99", 24, 1.65);
      return;
    }

    if (obj.type === "ramp") {
      jump();
      floatingText("JUMP BOOST", obj.x, obj.y, "#38bdf8");
      return;
    }

    if (state.invincibleTimer > 0 || state.shieldTimer > 0) {
      state.shake = 0.8;
      state.flash = 0.25;
      floatingText("BLOCKED", obj.x, obj.y, "#38bdf8");
      burst(obj.x, obj.y, "#38bdf8", 24, 1.7);

      if (state.shieldTimer > 0) {
        state.shieldTimer = Math.max(0, state.shieldTimer - 1600);
      }

      return;
    }

    damage(obj);
  }

  function collect(value, label, color) {
    const gain = Math.floor(value * state.combo);
    state.coins += label === "GEM" ? 0 : gain;
    state.gems += label === "GEM" ? 1 : 0;
    state.score += gain * 4;
    state.xp += Math.max(5, Math.floor(gain / 2));
    state.combo = clamp(state.combo + 0.18, 1, 8);
    state.comboTimer = 2600;

    floatingText(`+${gain} ${label}`, state.playerX, state.playerY - 80, color);
    updateLevelFromXp();
  }

  function activatePower(power) {
    if (power === "shield") state.shieldTimer = CONFIG.shieldMs;
    if (power === "magnet") state.magnetTimer = CONFIG.magnetMs;
    if (power === "boost") state.boostTimer = CONFIG.boostMs;
    if (power === "slowmo") state.slowmoTimer = CONFIG.slowMoMs;

    state.score += 250;
    state.xp += 45;
    state.combo = clamp(state.combo + 0.4, 1, 8);
    state.comboTimer = 3000;

    floatingText(`${POWERUPS[power]?.label || "POWER"}!`, state.playerX, state.playerY - 120, POWERUPS[power]?.color || "#66ff99");
    updateLevelFromXp();
  }

  function damage(obj) {
    state.shake = 1;
    state.flash = 1;
    state.gameOver = true;
    state.running = false;

    const finalScore = Math.floor(state.score + state.distance);
    state.highScore = Math.max(state.highScore, finalScore);
    state.totalCoins += state.coins;
    state.xp += Math.floor(finalScore / 40);
    updateLevelFromXp();
    saveGame();

    burst(obj.x, obj.y, "#ff3355", 36, 2.4);
    floatingText("BUSTED", state.w / 2, state.h * 0.38, "#ff3355");

    window.dispatchEvent(
      new CustomEvent("rb:game-run-complete", {
        detail: {
          game: GAME_ID,
          score: finalScore,
          coins: state.coins,
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
      b.y += speed * 0.8 * (dt / 16.67);

      if (b.y > state.h + 260) {
        b.y = rand(-380, -80);
        b.w = rand(34, 76);
        b.h = rand(90, 270);
        b.glow = rand(0.2, 0.72);
      }
    });

    if (chance(0.14)) {
      addSmoke(rand(0, state.w), state.h + 30, rand(0.4, 1.2));
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
        life: rand(320, 760),
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
      vx: rand(-0.22, 0.22),
      vy: rand(-1.4, -0.35),
      r: rand(16, 48) * power,
      grow: rand(0.08, 0.28) * power,
      life: rand(900, 1800),
      alpha: rand(0.035, 0.11)
    });
  }

  function floatingText(text, x, y, color = "#ffd86b") {
    state.texts.push({
      text,
      x,
      y,
      color,
      vy: -1.35,
      life: 900,
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
    g.addColorStop(0, "#041d0d");
    g.addColorStop(0.45, "#020604");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (state.imageReady.gaming) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      coverImage(ctx, state.images.gaming, 0, 0, w, h);
      ctx.restore();
    }

    state.stars.forEach((star) => {
      const twinkle = 0.45 + Math.sin(time * 0.002 + star.p) * 0.35;
      ctx.fillStyle = `rgba(255,255,255,${star.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h * 0.65, star.s, 0, Math.PI * 2);
      ctx.fill();
    });

    state.buildings.forEach((b) => {
      const bw = b.w;
      const bh = b.h;
      const x = b.side < 0 ? 14 : w - bw - 14;

      ctx.fillStyle = "rgba(0,0,0,0.48)";
      roundRect(ctx, x, b.y, bw, bh, 10);
      ctx.fill();

      ctx.fillStyle = `rgba(102,255,153,${0.08 + b.glow * 0.08})`;
      for (let wy = b.y + 14; wy < b.y + bh - 12; wy += 22) {
        for (let wx = x + 10; wx < x + bw - 10; wx += 18) {
          ctx.fillRect(wx, wy, 5, 8);
        }
      }
    });

    state.smoke.forEach((s) => {
      const alpha = Math.max(0, s.life / 1800) * s.alpha;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grad.addColorStop(0, `rgba(102,255,153,${alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRoad(ctx, w, h, time) {
    const topW = w * 0.28;
    const bottomW = w * 0.92;
    const cx = w / 2;

    ctx.save();

    const road = ctx.createLinearGradient(0, CONFIG.roadTop, 0, h);
    road.addColorStop(0, "rgba(3,18,9,0.88)");
    road.addColorStop(1, "rgba(0,0,0,0.95)");

    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, CONFIG.roadTop);
    ctx.lineTo(cx + topW / 2, CONFIG.roadTop);
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

      ctx.strokeStyle = "rgba(102,255,153,0.26)";
      ctx.lineWidth = 2;
      ctx.setLineDash([24, 24]);
      ctx.beginPath();
      ctx.moveTo(xTop, CONFIG.roadTop);
      ctx.lineTo(xBottom, h + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    state.roadLines.forEach((line) => {
      const p = line.y / h;
      const y = lerp(CONFIG.roadTop, h, p);
      const width = lerp(topW * 0.18, bottomW * 0.24, p);

      ctx.globalAlpha = line.a * 0.55;
      ctx.fillStyle = "rgba(250,204,21,0.28)";
      roundRect(ctx, cx - width / 2, y, width, 5, 999);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.restore();
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
      if (obj.type === "gem") drawGem(ctx);
      if (obj.type === "powerup") drawPowerup(ctx, obj.power);
      if (obj.type === "obstacle") drawCone(ctx);
      if (obj.type === "barrier") drawBarrier(ctx);
      if (obj.type === "enemy") drawEnemy(ctx);
      if (obj.type === "ramp") drawRamp(ctx);

      ctx.restore();
    });
  }

  function drawCoin(ctx) {
    ctx.fillStyle = "#ffd86b";
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
    ctx.fillStyle = "#66ff99";
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

  function drawGem(ctx) {
    ctx.fillStyle = "#a855f7";
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

  function drawCone(ctx) {
    ctx.fillStyle = "#ff7a18";
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(28, 28);
    ctx.lineTo(-28, 28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fefce8";
    ctx.fillRect(-18, 6, 36, 8);
  }

  function drawBarrier(ctx) {
    ctx.fillStyle = "#111827";
    roundRect(ctx, -48, -28, 96, 56, 14);
    ctx.fill();

    ctx.fillStyle = "#ffd86b";
    for (let i = -42; i < 42; i += 24) {
      ctx.save();
      ctx.translate(i, 0);
      ctx.rotate(-0.7);
      ctx.fillRect(-5, -34, 10, 68);
      ctx.restore();
    }
  }

  function drawEnemy(ctx) {
    ctx.fillStyle = "#ef4444";
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

  function drawRamp(ctx) {
    ctx.fillStyle = "#38bdf8";
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
    const lean = (laneX(state.lane) - x) * 0.01;

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

    const bodyH = state.sliding ? 38 : 70;
    const bodyY = state.sliding ? 8 : -10;

    ctx.fillStyle = "#030705";
    roundRect(ctx, -24, bodyY - bodyH / 2, 48, bodyH, 18);
    ctx.fill();

    const hoodie = ctx.createLinearGradient(-24, -50, 24, 28);
    hoodie.addColorStop(0, "#062f19");
    hoodie.addColorStop(0.55, "#020402");
    hoodie.addColorStop(1, "#0f172a");
    ctx.fillStyle = hoodie;
    roundRect(ctx, -28, bodyY - bodyH / 2, 56, bodyH, 18);
    ctx.fill();

    ctx.fillStyle = "#ffd86b";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RB", 0, bodyY - 6);

    ctx.fillStyle = "#d89a78";
    ctx.beginPath();
    ctx.arc(0, -58, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#030303";
    roundRect(ctx, -24, -70, 48, 16, 8);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    roundRect(ctx, -28, -86, 56, 20, 10);
    ctx.fill();

    ctx.fillStyle = "#050505";
    roundRect(ctx, -22, -62, 44, 8, 999);
    ctx.fill();

    ctx.strokeStyle = "#ffd86b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -20, 25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#ffd86b";
    ctx.beginPath();
    ctx.arc(0, 5, 7, 0, Math.PI * 2);
    ctx.fill();

    if (state.dashing) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#ffd86b";
      roundRect(ctx, -42, -18, 84, 50, 20);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawParticles(ctx) {
    state.particles.forEach((p) => {
      const alpha = Math.max(0, p.life / 760) * (p.alpha ?? 1);
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
      const alpha = Math.max(0, text.life / 900);
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

    drawPill(ctx, 16, 18, `SCORE ${finalScore.toLocaleString()}`, "#ffd86b");
    drawPill(ctx, 16, 62, `COINS ${state.coins.toLocaleString()}`, "#66ff99");
    drawPill(ctx, w - 156, 18, `LVL ${state.level}`, "#38bdf8");
    drawPill(ctx, w - 156, 62, `x${state.combo.toFixed(1)}`, "#a855f7");

    let x = 16;
    let y = 108;

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
        "BUSTED",
        `Score ${Math.floor(state.score + state.distance).toLocaleString()} • High ${state.highScore.toLocaleString()} • Press R`
      );
    }
  }

  function drawStartOverlay(ctx, w, h) {
    ctx.save();

    const boxW = Math.min(340, w - 32);
    const boxH = 210;
    const x = (w - boxW) / 2;
    const y = h * 0.34;

    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffd86b";
    ctx.font = "1000 38px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("MONEY ROAD", w / 2, y + 58);

    ctx.fillStyle = "#66ff99";
    ctx.font = "1000 18px system-ui";
    ctx.fillText("RUNNER", w / 2, y + 88);

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "800 14px system-ui";
    ctx.fillText("Swipe • Arrows • WASD", w / 2, y + 126);
    ctx.fillText("Collect cash, dodge ops, stack XP", w / 2, y + 150);

    ctx.fillStyle = "#041006";
    ctx.fillRect(w / 2 - 104, y + 168, 208, 32);
    ctx.fillStyle = "#66ff99";
    roundRect(ctx, w / 2 - 104, y + 168, 208, 32, 999);
    ctx.fill();

    ctx.fillStyle = "#041006";
    ctx.font = "1000 13px system-ui";
    ctx.fillText("TAP TO START", w / 2, y + 189);

    ctx.restore();
  }

  function drawCenterBox(ctx, w, h, title, subtitle) {
    ctx.save();

    const boxW = Math.min(360, w - 32);
    const boxH = 180;
    const x = (w - boxW) / 2;
    const y = h * 0.36;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.32)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = title === "BUSTED" ? "#ff3355" : "#ffd86b";
    ctx.font = "1000 42px system-ui";
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
