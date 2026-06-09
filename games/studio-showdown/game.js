/* =========================
   RICH BIZNESS MOBILE
   /games/studio-showdown/game.js

   STUDIO SHOWDOWN
   Full Extreme Action Fighting Game
   Combo Combat • Boss Waves • Powers • XP Sync
   Mobile + Desktop Controls
   No External Dependencies
========================= */

(() => {
  "use strict";

  const GAME_ID = "studio-showdown";
  const STORAGE_KEY = "rb_studio_showdown_save_v1";

  const CONFIG = Object.freeze({
    title: "Studio Showdown",
    brand: "Rich Bizness LLC",

    gravity: 0.92,
    floorRatio: 0.79,

    playerSpeed: 6.8,
    dashSpeed: 18,
    jumpPower: -18,

    enemyBaseSpeed: 2.2,
    enemyMaxSpeed: 5.8,

    waveBreakMs: 1800,
    spawnBaseMs: 820,
    spawnMinMs: 320,

    attackMs: 190,
    heavyMs: 360,
    specialMs: 760,
    dashMs: 180,
    parryMs: 240,

    shieldMs: 5200,
    rageMs: 6200,
    focusMs: 5200,

    colors: {
      black: "#020402",
      deep: "#03140b",
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
    studio: "/images/D8F60174-7E0C-44AF-A4AB-496AB7ADEC52.png"
  });

  const POWERS = Object.freeze({
    shield: {
      label: "SHIELD",
      icon: "🛡️",
      color: "#38bdf8"
    },
    rage: {
      label: "RAGE",
      icon: "🔥",
      color: "#ff3355"
    },
    focus: {
      label: "FOCUS",
      icon: "⚡",
      color: "#ffd86b"
    },
    heal: {
      label: "HEAL",
      icon: "💚",
      color: "#66ff99"
    }
  });

  const state = {
    booted: false,
    running: false,
    paused: false,
    gameOver: false,
    victory: false,

    canvas: null,
    ctx: null,
    dpr: 1,
    w: 390,
    h: 844,
    floorY: 670,

    lastTime: 0,
    elapsed: 0,

    shake: 0,
    flash: 0,
    freeze: 0,
    hitStop: 0,

    score: 0,
    cash: 0,
    knockouts: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,

    wave: 1,
    waveTimer: 0,
    spawnTimer: 0,
    spawnEvery: CONFIG.spawnBaseMs,
    bossSpawned: false,

    xp: 0,
    level: 1,
    rank: "Studio Fighter",

    highScore: 0,
    totalCash: 0,
    totalRuns: 0,
    totalKos: 0,

    player: {
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      w: 48,
      h: 88,
      facing: 1,
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      grounded: true,
      attacking: false,
      heavy: false,
      special: false,
      blocking: false,
      parrying: false,
      dashing: false,
      attackTimer: 0,
      heavyTimer: 0,
      specialTimer: 0,
      parryTimer: 0,
      dashTimer: 0,
      invincibleTimer: 0,
      shieldTimer: 0,
      rageTimer: 0,
      focusTimer: 0,
      cooldown: 0,
      hurtTimer: 0
    },

    camera: {
      x: 0,
      targetX: 0
    },

    enemies: [],
    pickups: [],
    particles: [],
    texts: [],
    smoke: [],
    lights: [],
    speakers: [],
    crowd: [],

    input: {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: false,
      heavy: false,
      special: false,
      block: false,
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
      state.totalKos = Number(save.totalKos || 0);
      state.xp = Number(save.xp || 0);
      state.level = Number(save.level || 1);
      state.rank = save.rank || getRank(state.level);
    } catch {
      state.highScore = 0;
      state.totalCash = 0;
      state.totalRuns = 0;
      state.totalKos = 0;
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
          totalKos: state.totalKos,
          xp: state.xp,
          level: state.level,
          rank: state.rank
        })
      );
    } catch {
      /* storage may fail in private mode */
    }
  }

  function getRank(level) {
    if (level >= 60) return "Showdown God";
    if (level >= 45) return "Studio Champion";
    if (level >= 32) return "Beatdown Legend";
    if (level >= 22) return "Combo Boss";
    if (level >= 13) return "Power Fighter";
    if (level >= 7) return "Studio Striker";
    return "Studio Fighter";
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
    const existing = qs("#studioShowdownCanvas") || qs("canvas[data-studio-showdown]");
    const container =
      qs("#studio-showdown") ||
      qs("[data-game='studio-showdown']") ||
      qs(".studio-showdown") ||
      document.body;

    const canvas = existing || document.createElement("canvas");

    canvas.id = canvas.id || "studioShowdownCanvas";
    canvas.dataset.studioShowdown = "true";
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
    state.lights = Array.from({ length: 18 }, (_, i) => ({
      x: (i / 17) * state.w,
      y: rand(24, state.h * 0.28),
      r: rand(120, 240),
      color: ["#66ff99", "#ffd86b", "#38bdf8", "#a855f7"][Math.floor(rand(0, 4))],
      phase: rand(0, Math.PI * 2)
    }));

    state.speakers = Array.from({ length: 8 }, (_, i) => ({
      x: (i / 7) * state.w,
      y: state.floorY + rand(12, 30),
      scale: rand(0.65, 1.15),
      pulse: rand(0, Math.PI * 2)
    }));

    state.crowd = Array.from({ length: 42 }, () => ({
      x: rand(0, state.w),
      y: rand(state.floorY - 80, state.floorY - 22),
      h: rand(18, 42),
      color: ["#66ff99", "#ffd86b", "#38bdf8", "#a855f7", "#ffffff"][Math.floor(rand(0, 5))],
      phase: rand(0, Math.PI * 2)
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

    window.RB_STUDIO_SHOWDOWN = {
      start,
      pause,
      resume,
      restart,
      resetSave,
      attack,
      heavyAttack,
      specialAttack,
      block,
      dash,
      jump,
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

    state.floorY = state.h * CONFIG.floorRatio;
    state.player.y = state.floorY;
    state.player.x = clamp(state.player.x || state.w * 0.28, 70, state.w - 70);

    buildWorld();
  }

  function resetRun() {
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.victory = false;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.freeze = 0;
    state.hitStop = 0;

    state.score = 0;
    state.cash = 0;
    state.knockouts = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;

    state.wave = 1;
    state.waveTimer = CONFIG.waveBreakMs;
    state.spawnTimer = 0;
    state.spawnEvery = CONFIG.spawnBaseMs;
    state.bossSpawned = false;

    Object.assign(state.player, {
      x: state.w * 0.28,
      y: state.floorY,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      grounded: true,
      attacking: false,
      heavy: false,
      special: false,
      blocking: false,
      parrying: false,
      dashing: false,
      attackTimer: 0,
      heavyTimer: 0,
      specialTimer: 0,
      parryTimer: 0,
      dashTimer: 0,
      invincibleTimer: 1200,
      shieldTimer: 0,
      rageTimer: 0,
      focusTimer: 0,
      cooldown: 0,
      hurtTimer: 0
    });

    state.enemies.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.smoke.length = 0;

    updateLevelFromXp();
  }

  function start() {
    if (state.running && !state.gameOver) return;

    if (state.gameOver || state.victory) {
      resetRun();
    }

    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.victory = false;
    state.totalRuns += 1;
    saveGame();

    burst(state.player.x, state.player.y - 45, CONFIG.colors.green, 28, 1.8);
    floatingText("SHOWDOWN!", state.w / 2, state.h * 0.34, CONFIG.colors.gold);
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
    state.totalKos = 0;
    state.xp = 0;
    state.level = 1;
    state.rank = getRank(1);
    resetRun();
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (["arrowleft", "a"].includes(key)) state.input.left = true;
    if (["arrowright", "d"].includes(key)) state.input.right = true;
    if (["arrowup", "w", " "].includes(key)) jump();
    if (["arrowdown", "s"].includes(key)) block(true);

    if (key === "j" || key === "z") attack();
    if (key === "k" || key === "x") heavyAttack();
    if (key === "l" || key === "c") specialAttack();
    if (key === "shift") dash();

    if (key === "enter") start();
    if (key === "p") state.paused = !state.paused;
    if (key === "r") restart();
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();

    if (["arrowleft", "a"].includes(key)) state.input.left = false;
    if (["arrowright", "d"].includes(key)) state.input.right = false;
    if (["arrowdown", "s"].includes(key)) block(false);
  }

  function onPointerDown(event) {
    event.preventDefault();

    state.input.pointerDown = true;
    state.input.startX = event.clientX;
    state.input.startY = event.clientY;

    if (!state.running || state.gameOver) {
      start();
      return;
    }

    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;

    if (y > 0.72) {
      if (x < 0.25) state.input.left = true;
      else if (x < 0.5) state.input.right = true;
      else if (x < 0.72) attack();
      else specialAttack();
    } else {
      attack();
    }
  }

  function onPointerMove(event) {
    if (!state.input.pointerDown) return;

    const dx = event.clientX - state.input.startX;
    const dy = event.clientY - state.input.startY;

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        state.input.right = true;
        state.input.left = false;
      } else {
        state.input.left = true;
        state.input.right = false;
      }
    }

    if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) jump();
      if (dy > 0) block(true);

      state.input.startX = event.clientX;
      state.input.startY = event.clientY;
    }
  }

  function onPointerUp() {
    state.input.pointerDown = false;
    state.input.left = false;
    state.input.right = false;
    block(false);
  }

  function jump() {
    if (state.gameOver || !state.player.grounded) return;

    state.player.grounded = false;
    state.player.vy = CONFIG.jumpPower;
    burst(state.player.x, state.player.y, CONFIG.colors.gold, 14, 1.2);
  }

  function dash() {
    const p = state.player;
    if (state.gameOver || p.dashing || p.energy < 12) return;

    p.dashing = true;
    p.dashTimer = CONFIG.dashMs;
    p.invincibleTimer = Math.max(p.invincibleTimer, CONFIG.dashMs + 120);
    p.energy -= 12;
    p.vx = p.facing * CONFIG.dashSpeed;
    state.flash = 0.22;
    burst(p.x, p.y - 42, CONFIG.colors.gold, 22, 1.8);
  }

  function block(active = true) {
    const p = state.player;
    p.blocking = active;

    if (active && p.energy > 8 && !p.parrying) {
      p.parrying = true;
      p.parryTimer = CONFIG.parryMs;
    }
  }

  function attack() {
    const p = state.player;
    if (state.gameOver || p.cooldown > 0 || p.energy < 5) return;

    p.attacking = true;
    p.attackTimer = CONFIG.attackMs;
    p.cooldown = 120;
    p.energy -= 5;

    const reach = p.rageTimer > 0 ? 96 : 78;
    const damage = p.rageTimer > 0 ? 18 : 12;
    const color = p.rageTimer > 0 ? CONFIG.colors.red : CONFIG.colors.green;

    strike({
      reach,
      damage,
      knockback: 9,
      color,
      label: "HIT",
      energyGain: 3
    });

    slashEffect(p.x + p.facing * 42, p.y - 50, color, p.facing, 1);
  }

  function heavyAttack() {
    const p = state.player;
    if (state.gameOver || p.cooldown > 0 || p.energy < 16) return;

    p.heavy = true;
    p.heavyTimer = CONFIG.heavyMs;
    p.cooldown = 320;
    p.energy -= 16;
    state.hitStop = 70;

    const reach = p.rageTimer > 0 ? 126 : 104;
    const damage = p.rageTimer > 0 ? 38 : 26;
    const color = p.rageTimer > 0 ? CONFIG.colors.red : CONFIG.colors.gold;

    setTimeout(() => {
      if (!state.running || state.gameOver) return;

      strike({
        reach,
        damage,
        knockback: 18,
        color,
        label: "HEAVY",
        energyGain: 8
      });

      shockwave(p.x + p.facing * 60, p.y - 40, color);
      state.shake = 0.55;
    }, 110);
  }

  function specialAttack() {
    const p = state.player;
    if (state.gameOver || p.cooldown > 0 || p.energy < 42) return;

    p.special = true;
    p.specialTimer = CONFIG.specialMs;
    p.cooldown = 680;
    p.energy -= 42;
    p.invincibleTimer = Math.max(p.invincibleTimer, 580);
    state.hitStop = 100;
    state.flash = 0.4;
    state.shake = 0.75;

    const color = p.rageTimer > 0 ? CONFIG.colors.red : CONFIG.colors.purple;

    for (let i = 0; i < 8; i += 1) {
      setTimeout(() => {
        if (!state.running || state.gameOver) return;

        slashEffect(
          p.x + p.facing * rand(26, 118),
          p.y - rand(36, 100),
          i % 2 ? CONFIG.colors.gold : color,
          p.facing,
          rand(0.8, 1.4)
        );

        strike({
          reach: 142,
          damage: p.rageTimer > 0 ? 16 : 11,
          knockback: 7,
          color: i % 2 ? CONFIG.colors.gold : color,
          label: "SPECIAL",
          energyGain: 1,
          allowMulti: true
        });
      }, i * 62);
    }

    floatingText("STUDIO BLAST", p.x, p.y - 130, color);
  }

  function strike(options) {
    const p = state.player;
    const hitX = p.x + p.facing * options.reach;
    const hitY = p.y - 52;
    let hitAny = false;

    state.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      if (!options.allowMulti && enemy.hitStamp === state.elapsed) return;

      const dx = Math.abs(enemy.x - hitX);
      const dy = Math.abs(enemy.y - hitY);

      if (dx < enemy.w * 0.5 + options.reach * 0.45 && dy < enemy.h * 0.55 + 52) {
        enemy.hitStamp = state.elapsed;
        damageEnemy(enemy, options.damage, options.knockback * p.facing, options.color, options.label);
        hitAny = true;
      }
    });

    if (hitAny) {
      p.energy = clamp(p.energy + options.energyGain, 0, p.maxEnergy);
      state.combo += 1;
      state.comboTimer = 2400;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.score += Math.floor(35 * Math.max(1, state.combo * 0.2));
      state.xp += 5;
      updateLevelFromXp();
    }
  }

  function damageEnemy(enemy, amount, knockback, color, label) {
    const damage = Math.floor(amount * (state.player.rageTimer > 0 ? 1.2 : 1));
    enemy.hp -= damage;
    enemy.vx += knockback;
    enemy.hurtTimer = 220;
    enemy.y -= enemy.grounded ? 0 : 8;

    state.hitStop = Math.max(state.hitStop, 45);
    state.shake = Math.max(state.shake, 0.32);

    burst(enemy.x, enemy.y - 48, color, 14, 1.4);
    floatingText(`${label} -${damage}`, enemy.x, enemy.y - enemy.h - 10, color);

    if (enemy.hp <= 0) {
      knockoutEnemy(enemy, color);
    }
  }

  function knockoutEnemy(enemy, color) {
    enemy.dead = true;
    enemy.deathTimer = 500;
    enemy.vx += state.player.facing * 10;
    enemy.vy = -10;

    const reward = enemy.type === "boss" ? 550 : enemy.type === "elite" ? 180 : 85;
    const cash = enemy.type === "boss" ? 260 : enemy.type === "elite" ? 90 : 35;

    state.score += reward * Math.max(1, state.combo);
    state.cash += cash;
    state.knockouts += 1;
    state.totalKos += 1;
    state.xp += enemy.type === "boss" ? 170 : enemy.type === "elite" ? 70 : 34;

    floatingText("KO!", enemy.x, enemy.y - 120, CONFIG.colors.gold);
    burst(enemy.x, enemy.y - 48, color, enemy.type === "boss" ? 44 : 24, enemy.type === "boss" ? 2.2 : 1.5);

    if (chance(enemy.type === "boss" ? 0.9 : 0.22)) {
      spawnPickup(enemy.x, enemy.y - 50);
    }

    updateLevelFromXp();
  }

  function spawnPickup(x, y) {
    const types = ["shield", "rage", "focus", "heal"];
    const power = types[Math.floor(rand(0, types.length))];

    state.pickups.push({
      type: "power",
      power,
      x,
      y,
      vx: rand(-1.2, 1.2),
      vy: -4,
      r: 22,
      life: 9000
    });
  }

  function activatePower(power) {
    const p = state.player;

    if (power === "shield") p.shieldTimer = CONFIG.shieldMs;
    if (power === "rage") p.rageTimer = CONFIG.rageMs;
    if (power === "focus") p.focusTimer = CONFIG.focusMs;
    if (power === "heal") p.hp = clamp(p.hp + 35, 0, p.maxHp);

    state.score += 220;
    state.xp += 45;
    updateLevelFromXp();

    floatingText(`${POWERS[power]?.label || "POWER"}!`, p.x, p.y - 124, POWERS[power]?.color || CONFIG.colors.green);
    burst(p.x, p.y - 52, POWERS[power]?.color || CONFIG.colors.green, 28, 1.8);
  }

  function loop(time) {
    const rawDt = Math.min(40, time - (state.lastTime || time));
    state.lastTime = time;

    if (state.freeze > 0 || state.hitStop > 0) {
      state.freeze = Math.max(0, state.freeze - rawDt);
      state.hitStop = Math.max(0, state.hitStop - rawDt);
      draw(time);
      requestAnimationFrame(loop);
      return;
    }

    if (!state.paused && state.running && !state.gameOver && !state.victory) {
      update(rawDt, time);
    } else {
      updateIdle(rawDt, time);
    }

    draw(time);
    requestAnimationFrame(loop);
  }

  function update(dt, time) {
    const focusFactor = state.player.focusTimer > 0 ? 0.72 : 1;

    state.elapsed += dt;
    state.score += Math.floor(dt * 0.018 * Math.max(1, state.combo * 0.12));

    updateTimers(dt);
    updatePlayer(dt);
    updateEnemies(dt * focusFactor);
    updatePickups(dt);
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt);

    handleWaves(dt);
    updateCombo(dt);
    updateCamera();

    if (state.player.hp <= 0) {
      loseGame();
    }
  }

  function updateIdle(dt) {
    updateParticles(dt);
    updateTexts(dt);
    updateWorld(dt * 0.6);
  }

  function updateTimers(dt) {
    const p = state.player;

    state.shake = Math.max(0, state.shake - dt * 0.004);
    state.flash = Math.max(0, state.flash - dt * 0.004);

    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.heavyTimer = Math.max(0, p.heavyTimer - dt);
    p.specialTimer = Math.max(0, p.specialTimer - dt);
    p.parryTimer = Math.max(0, p.parryTimer - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.invincibleTimer = Math.max(0, p.invincibleTimer - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);

    p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    p.rageTimer = Math.max(0, p.rageTimer - dt);
    p.focusTimer = Math.max(0, p.focusTimer - dt);

    p.attacking = p.attackTimer > 0;
    p.heavy = p.heavyTimer > 0;
    p.special = p.specialTimer > 0;
    p.parrying = p.parryTimer > 0;
    p.dashing = p.dashTimer > 0;

    p.energy = clamp(p.energy + dt * 0.026, 0, p.maxEnergy);
  }

  function updatePlayer(dt) {
    const p = state.player;
    let input = 0;

    if (state.input.left) input -= 1;
    if (state.input.right) input += 1;

    if (input !== 0) {
      p.facing = input;
    }

    const speed = p.dashing ? CONFIG.dashSpeed : CONFIG.playerSpeed;
    p.vx = lerp(p.vx, input * speed, p.dashing ? 0.16 : 0.24);

    if (p.blocking) {
      p.vx *= 0.42;
      p.energy = Math.max(0, p.energy - dt * 0.012);
    }

    p.x += p.vx;
    p.x = clamp(p.x, 38, state.w - 38);

    p.vy += CONFIG.gravity;
    p.y += p.vy;

    if (p.y >= state.floorY) {
      p.y = state.floorY;
      p.vy = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }

    if (p.dashing || p.rageTimer > 0 || p.shieldTimer > 0) {
      addTrail(p.x - p.facing * 24, p.y - 46, p.rageTimer > 0 ? CONFIG.colors.red : p.shieldTimer > 0 ? CONFIG.colors.blue : CONFIG.colors.gold, 0.42);
    }
  }

  function handleWaves(dt) {
    state.waveTimer = Math.max(0, state.waveTimer - dt);

    const alive = state.enemies.filter((enemy) => !enemy.dead).length;

    if (state.waveTimer <= 0 && alive < Math.min(4 + Math.floor(state.wave / 2), 8)) {
      state.spawnTimer -= dt;
      state.spawnEvery = clamp(CONFIG.spawnBaseMs - state.wave * 24, CONFIG.spawnMinMs, CONFIG.spawnBaseMs);

      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnTimer = state.spawnEvery * rand(0.75, 1.2);
      }
    }

    const waveGoal = 4 + state.wave * 2;
    if (state.knockouts >= waveGoal && alive === 0) {
      nextWave();
    }
  }

  function nextWave() {
    state.wave += 1;
    state.waveTimer = CONFIG.waveBreakMs;
    state.bossSpawned = false;
    state.player.hp = clamp(state.player.hp + 14, 0, state.player.maxHp);
    state.player.energy = clamp(state.player.energy + 34, 0, state.player.maxEnergy);

    floatingText(`WAVE ${state.wave}`, state.w / 2, state.h * 0.35, CONFIG.colors.gold);
    burst(state.w / 2, state.floorY - 110, CONFIG.colors.green, 34, 2);

    if (state.wave > 8) {
      winGame();
    }
  }

  function spawnEnemy() {
    const side = chance(0.5) ? -1 : 1;
    const type =
      state.wave % 4 === 0 && !state.bossSpawned
        ? "boss"
        : chance(0.25 + state.wave * 0.015)
          ? "elite"
          : chance(0.34)
            ? "rusher"
            : "goon";

    if (type === "boss") {
      state.bossSpawned = true;
    }

    const hp =
      type === "boss"
        ? 210 + state.wave * 24
        : type === "elite"
          ? 90 + state.wave * 8
          : type === "rusher"
            ? 48 + state.wave * 5
            : 62 + state.wave * 6;

    const enemy = {
      id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
      type,
      x: side < 0 ? -70 : state.w + 70,
      y: state.floorY,
      vx: 0,
      vy: 0,
      w: type === "boss" ? 76 : type === "elite" ? 62 : 52,
      h: type === "boss" ? 122 : type === "elite" ? 102 : 88,
      hp,
      maxHp: hp,
      damage: type === "boss" ? 18 + state.wave : type === "elite" ? 12 + state.wave * 0.5 : 8 + state.wave * 0.4,
      speed: type === "rusher" ? 4.1 + state.wave * 0.11 : type === "boss" ? 1.7 + state.wave * 0.05 : 2.4 + state.wave * 0.08,
      attackRange: type === "boss" ? 88 : 64,
      attackCooldown: rand(400, 900),
      attackTimer: 0,
      hitStamp: 0,
      hurtTimer: 0,
      dead: false,
      deathTimer: 0,
      grounded: true,
      facing: side < 0 ? 1 : -1,
      color:
        type === "boss"
          ? CONFIG.colors.red
          : type === "elite"
            ? CONFIG.colors.purple
            : type === "rusher"
              ? CONFIG.colors.orange
              : CONFIG.colors.blue
    };

    state.enemies.push(enemy);
    addSmoke(enemy.x, enemy.y - 30, 1.8);
  }

  function updateEnemies(dt) {
    const p = state.player;

    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];

      if (enemy.dead) {
        enemy.deathTimer -= dt;
        enemy.vy += CONFIG.gravity * 0.8;
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        if (enemy.y > state.h + 160 || enemy.deathTimer <= 0) {
          state.enemies.splice(i, 1);
        }

        continue;
      }

      enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);

      const dx = p.x - enemy.x;
      enemy.facing = dx >= 0 ? 1 : -1;

      if (Math.abs(dx) > enemy.attackRange) {
        enemy.vx = lerp(enemy.vx, enemy.facing * enemy.speed, 0.045);
      } else {
        enemy.vx = lerp(enemy.vx, 0, 0.08);

        if (enemy.attackCooldown <= 0) {
          enemyAttack(enemy);
        }
      }

      enemy.x += enemy.vx;
      enemy.vy += CONFIG.gravity;
      enemy.y += enemy.vy;

      if (enemy.y >= state.floorY) {
        enemy.y = state.floorY;
        enemy.vy = 0;
        enemy.grounded = true;
      }

      enemy.x = clamp(enemy.x, -120, state.w + 120);
    }
  }

  function enemyAttack(enemy) {
    enemy.attackTimer = 260;
    enemy.attackCooldown = enemy.type === "boss" ? rand(650, 1050) : rand(820, 1300);

    setTimeout(() => {
      if (!state.running || state.gameOver || enemy.dead) return;

      const p = state.player;
      const dx = Math.abs(p.x - enemy.x);
      const dy = Math.abs(p.y - enemy.y);

      if (dx < enemy.attackRange + 20 && dy < 90) {
        damagePlayer(enemy);
      }

      slashEffect(enemy.x + enemy.facing * 34, enemy.y - 52, enemy.color, enemy.facing, enemy.type === "boss" ? 1.5 : 0.9);
    }, 120);
  }

  function damagePlayer(enemy) {
    const p = state.player;

    if (p.invincibleTimer > 0) return;

    if (p.parrying) {
      p.energy = clamp(p.energy + 18, 0, p.maxEnergy);
      enemy.vx += -enemy.facing * 12;
      enemy.hurtTimer = 260;

      state.combo += 1;
      state.comboTimer = 2400;
      state.score += 120;
      state.xp += 16;
      state.shake = 0.35;

      floatingText("PARRY!", p.x, p.y - 118, CONFIG.colors.blue);
      burst(enemy.x, enemy.y - 56, CONFIG.colors.blue, 22, 1.5);
      updateLevelFromXp();
      return;
    }

    const blocked = p.blocking || p.shieldTimer > 0;
    const amount = blocked ? enemy.damage * 0.28 : enemy.damage;

    p.hp = clamp(p.hp - amount, 0, p.maxHp);
    p.hurtTimer = 260;
    p.invincibleTimer = blocked ? 220 : 520;
    p.vx += enemy.facing * 8;

    state.shake = blocked ? 0.38 : 0.72;
    state.flash = blocked ? 0.18 : 0.38;
    state.combo = 0;

    floatingText(blocked ? "BLOCK" : `-${Math.floor(amount)}`, p.x, p.y - 112, blocked ? CONFIG.colors.blue : CONFIG.colors.red);
    burst(p.x, p.y - 48, blocked ? CONFIG.colors.blue : CONFIG.colors.red, blocked ? 16 : 26, blocked ? 1.2 : 1.8);
  }

  function updatePickups(dt) {
    const p = state.player;

    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];

      pickup.life -= dt;
      pickup.vy += CONFIG.gravity * 0.35;
      pickup.x += pickup.vx;
      pickup.y += pickup.vy;

      if (pickup.y > state.floorY - 24) {
        pickup.y = state.floorY - 24;
        pickup.vy *= -0.35;
      }

      if (Math.hypot(pickup.x - p.x, pickup.y - (p.y - 60)) < 56) {
        activatePower(pickup.power);
        state.pickups.splice(i, 1);
        continue;
      }

      if (pickup.life <= 0) {
        state.pickups.splice(i, 1);
      }
    }
  }

  function updateCombo(dt) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);

    if (state.comboTimer <= 0) {
      state.combo = Math.max(0, state.combo - 1);
      state.comboTimer = state.combo > 0 ? 520 : 0;
    }
  }

  function updateCamera() {
    const alive = state.enemies.filter((enemy) => !enemy.dead);

    if (alive.length) {
      const avg = alive.reduce((sum, enemy) => sum + enemy.x, state.player.x) / (alive.length + 1);
      state.camera.targetX = clamp(avg - state.w / 2, -60, 60);
    } else {
      state.camera.targetX = 0;
    }

    state.camera.x = lerp(state.camera.x, state.camera.targetX, 0.035);
  }

  function loseGame() {
    state.gameOver = true;
    state.running = false;
    state.flash = 1;
    state.shake = 1;

    const finalScore = Math.floor(state.score);
    state.highScore = Math.max(state.highScore, finalScore);
    state.totalCash += state.cash;
    state.xp += Math.floor(finalScore / 36);
    updateLevelFromXp();
    saveGame();

    floatingText("KNOCKED OUT", state.w / 2, state.h * 0.35, CONFIG.colors.red);

    window.dispatchEvent(
      new CustomEvent("rb:game-run-complete", {
        detail: {
          game: GAME_ID,
          score: finalScore,
          cash: state.cash,
          knockouts: state.knockouts,
          bestCombo: state.bestCombo,
          wave: state.wave,
          xp: state.xp,
          level: state.level,
          rank: state.rank
        }
      })
    );
  }

  function winGame() {
    state.victory = true;
    state.running = false;
    state.flash = 0.7;
    state.shake = 0.7;

    const finalScore = Math.floor(state.score + state.wave * 1000 + state.player.hp * 25);
    state.highScore = Math.max(state.highScore, finalScore);
    state.totalCash += state.cash + 500;
    state.cash += 500;
    state.xp += 500;
    updateLevelFromXp();
    saveGame();

    floatingText("STUDIO CHAMP!", state.w / 2, state.h * 0.35, CONFIG.colors.gold);
    burst(state.w / 2, state.floorY - 140, CONFIG.colors.gold, 70, 2.7);

    window.dispatchEvent(
      new CustomEvent("rb:game-run-complete", {
        detail: {
          game: GAME_ID,
          score: finalScore,
          cash: state.cash,
          knockouts: state.knockouts,
          bestCombo: state.bestCombo,
          wave: state.wave,
          victory: true,
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

  function updateWorld(dt) {
    if (chance(0.14)) {
      addSmoke(rand(0, state.w), state.floorY + rand(18, 90), rand(0.4, 1.15));
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
        life: rand(320, 820),
        gravity: rand(0.02, 0.08),
        rot: rand(0, Math.PI),
        spin: rand(-0.08, 0.08)
      });
    }
  }

  function slashEffect(x, y, color, facing = 1, scale = 1) {
    state.particles.push({
      type: "slash",
      x,
      y,
      vx: facing * 1.8,
      vy: rand(-0.4, 0.4),
      r: 32 * scale,
      color,
      life: 190,
      gravity: 0,
      rot: facing > 0 ? -0.28 : 0.28,
      spin: 0
    });
  }

  function shockwave(x, y, color) {
    state.particles.push({
      type: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      r: 24,
      color,
      life: 420,
      gravity: 0,
      rot: 0,
      spin: 0
    });
  }

  function addTrail(x, y, color, alpha = 0.55) {
    state.particles.push({
      x: x + rand(-16, 16),
      y: y + rand(-10, 24),
      vx: rand(-0.5, 0.5),
      vy: rand(0.5, 2.4),
      r: rand(4, 12),
      color,
      alpha,
      life: rand(160, 360),
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
      vy: rand(-1.45, -0.35),
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
    ctx.translate(sx - state.camera.x, sy);

    drawBackground(ctx, w, h, time);
    drawStage(ctx, w, h, time);
    drawPickups(ctx, time);
    drawEnemies(ctx, time);
    drawPlayer(ctx, time);
    drawParticles(ctx);
    drawHUD(ctx, w, h);
    drawOverlay(ctx, w, h);

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.3})`;
      ctx.fillRect(state.camera.x - 20, -20, w + 40, h + 40);
    }

    ctx.restore();
  }

  function drawBackground(ctx, w, h, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#071c11");
    g.addColorStop(0.48, "#020604");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(state.camera.x, 0, w, h);

    if (state.imageReady.studio) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      coverImage(ctx, state.images.studio, state.camera.x, 0, w, h);
      ctx.restore();
    } else if (state.imageReady.gaming) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      coverImage(ctx, state.images.gaming, state.camera.x, 0, w, h);
      ctx.restore();
    }

    state.lights.forEach((light) => {
      const pulse = 0.55 + Math.sin(time * 0.003 + light.phase) * 0.25;
      const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
      grad.addColorStop(0, hexToRgba(light.color, 0.16 * pulse));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.smoke.forEach((s) => {
      const alpha = Math.max(0, s.life / 1900) * s.alpha;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grad.addColorStop(0, `rgba(102,255,153,${alpha})`);
      grad.addColorStop(0.44, `rgba(255,216,107,${alpha * 0.22})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStage(ctx, w, h, time) {
    state.crowd.forEach((c) => {
      const bounce = Math.sin(time * 0.006 + c.phase) * 4;
      ctx.fillStyle = hexToRgba(c.color, 0.34);
      roundRect(ctx, c.x - 5, c.y - c.h + bounce, 10, c.h, 999);
      ctx.fill();
    });

    const floor = ctx.createLinearGradient(0, state.floorY - 40, 0, h);
    floor.addColorStop(0, "rgba(16,185,129,0.22)");
    floor.addColorStop(0.18, "rgba(2,4,2,0.94)");
    floor.addColorStop(1, "#000000");

    ctx.fillStyle = floor;
    ctx.fillRect(state.camera.x - 80, state.floorY, w + 160, h - state.floorY + 40);

    ctx.strokeStyle = "rgba(250,204,21,0.28)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(state.camera.x - 60, state.floorY);
    ctx.lineTo(state.camera.x + w + 60, state.floorY);
    ctx.stroke();

    for (let i = -1; i < 9; i += 1) {
      const x = i * (w / 6) + ((time * 0.02) % (w / 6));
      ctx.strokeStyle = "rgba(102,255,153,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, state.floorY);
      ctx.lineTo(x - 90, h + 40);
      ctx.stroke();
    }

    state.speakers.forEach((speaker) => {
      const pulse = 1 + Math.sin(time * 0.008 + speaker.pulse) * 0.06;
      drawSpeaker(ctx, speaker.x, speaker.y, speaker.scale * pulse);
    });

    ctx.save();
    ctx.fillStyle = CONFIG.colors.gold;
    ctx.font = "1000 22px system-ui";
    ctx.textAlign = "center";
    ctx.shadowColor = CONFIG.colors.gold;
    ctx.shadowBlur = 22;
    ctx.fillText("RICH BIZNESS STUDIOS", state.camera.x + w / 2, state.floorY - 150);
    ctx.restore();
  }

  function drawSpeaker(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    roundRect(ctx, -24, -72, 48, 72, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = "rgba(102,255,153,0.18)";
    ctx.beginPath();
    ctx.arc(0, -50, 13, 0, Math.PI * 2);
    ctx.arc(0, -22, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPlayer(ctx, time) {
    const p = state.player;
    const bob = p.grounded ? Math.sin(time * 0.012) * 2 : 0;
    const color = p.rageTimer > 0 ? CONFIG.colors.red : CONFIG.colors.green;

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(p.facing, 1);

    if (p.shieldTimer > 0) {
      ctx.strokeStyle = `rgba(56,189,248,${0.42 + Math.sin(time * 0.014) * 0.18})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -56, 58, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.rageTimer > 0) {
      ctx.fillStyle = `rgba(255,51,85,${0.14 + Math.sin(time * 0.018) * 0.06})`;
      ctx.beginPath();
      ctx.arc(0, -54, 76, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.focusTimer > 0) {
      ctx.strokeStyle = `rgba(255,216,107,${0.36 + Math.sin(time * 0.02) * 0.14})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -56, 76, 0, Math.PI * 2);
      ctx.stroke();
    }

    const hurt = p.hurtTimer > 0 && Math.floor(time / 60) % 2 === 0;

    ctx.fillStyle = hurt ? CONFIG.colors.red : "#d89a78";
    ctx.beginPath();
    ctx.arc(0, -86, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#020402";
    roundRect(ctx, -25, -101, 50, 16, 8);
    ctx.fill();

    ctx.fillStyle = "#050505";
    roundRect(ctx, -22, -90, 44, 8, 999);
    ctx.fill();

    const body = ctx.createLinearGradient(-28, -74, 28, -8);
    body.addColorStop(0, p.rageTimer > 0 ? "#5f0716" : "#064e2b");
    body.addColorStop(0.52, "#020402");
    body.addColorStop(1, "#111827");
    ctx.fillStyle = body;
    roundRect(ctx, -30, -72, 60, 72, 18);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.font = "900 19px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RB", 0, -42);

    ctx.strokeStyle = CONFIG.colors.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -34, 25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.beginPath();
    ctx.arc(0, -10, 7, 0, Math.PI * 2);
    ctx.fill();

    const armSwing = p.attacking ? -0.9 : p.heavy ? -1.2 : p.special ? Math.sin(time * 0.03) * 0.9 : Math.sin(time * 0.01) * 0.12;

    ctx.strokeStyle = "#d89a78";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(-24, -56);
    ctx.lineTo(-42, -18);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24, -56);
    ctx.lineTo(50 + Math.cos(armSwing) * 30, -34 + Math.sin(armSwing) * 34);
    ctx.stroke();

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-20, 34);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(22, 34);
    ctx.stroke();

    ctx.fillStyle = "#050505";
    roundRect(ctx, -34, 28, 28, 12, 6);
    ctx.fill();
    roundRect(ctx, 6, 28, 32, 12, 6);
    ctx.fill();

    if (p.blocking) {
      ctx.strokeStyle = CONFIG.colors.blue;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(32, -52, 36, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEnemies(ctx, time) {
    state.enemies.forEach((enemy) => {
      drawEnemy(ctx, enemy, time);
    });
  }

  function drawEnemy(ctx, enemy, time) {
    const hurt = enemy.hurtTimer > 0 && Math.floor(time / 45) % 2 === 0;
    const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(enemy.facing, 1);

    if (enemy.type === "boss") {
      ctx.fillStyle = `rgba(255,51,85,${0.15 + Math.sin(time * 0.01) * 0.05})`;
      ctx.beginPath();
      ctx.arc(0, -68, 88, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = hurt ? CONFIG.colors.white : "#d89a78";
    ctx.beginPath();
    ctx.arc(0, -enemy.h + 28, enemy.type === "boss" ? 27 : 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#020402";
    roundRect(ctx, -22, -enemy.h + 18, 44, 10, 999);
    ctx.fill();

    ctx.fillStyle = enemy.color;
    roundRect(ctx, -enemy.w / 2, -enemy.h + 58, enemy.w, enemy.h - 34, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    roundRect(ctx, -enemy.w / 2, -enemy.h - 18, enemy.w, 7, 999);
    ctx.fill();

    ctx.fillStyle = enemy.color;
    roundRect(ctx, -enemy.w / 2, -enemy.h - 18, enemy.w * hpPct, 7, 999);
    ctx.fill();

    if (enemy.attackTimer > 0) {
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = enemy.type === "boss" ? 8 : 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(20, -enemy.h + 78);
      ctx.lineTo(62, -enemy.h + 58);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPickups(ctx, time) {
    state.pickups.forEach((pickup) => {
      const data = POWERS[pickup.power] || POWERS.shield;

      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(Math.sin(time * 0.004) * 0.2);

      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.arc(0, 0, pickup.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.56)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "900 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.icon, 0, 1);

      ctx.restore();
    });
  }

  function drawParticles(ctx) {
    state.particles.forEach((p) => {
      const alpha = Math.max(0, p.life / 820) * (p.alpha ?? 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.type === "slash") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, -0.75, 0.75);
        ctx.stroke();
      } else if (p.type === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * (1 + (420 - p.life) / 180), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

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
    const p = state.player;

    drawBar(ctx, 16 + state.camera.x, 18, 154, 14, p.hp / p.maxHp, CONFIG.colors.red, "HP");
    drawBar(ctx, 16 + state.camera.x, 42, 154, 12, p.energy / p.maxEnergy, CONFIG.colors.gold, "POWER");

    drawPill(ctx, w - 160 + state.camera.x, 18, `WAVE ${state.wave}`, CONFIG.colors.green);
    drawPill(ctx, w - 160 + state.camera.x, 60, `KO ${state.knockouts}`, CONFIG.colors.gold);

    if (state.combo > 1) {
      drawPill(ctx, w / 2 - 70 + state.camera.x, 18, `${state.combo} HIT`, CONFIG.colors.purple);
    }

    let x = 16 + state.camera.x;
    const y = 66;

    if (p.shieldTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERS.shield.icon, p.shieldTimer / CONFIG.shieldMs, POWERS.shield.color);
      x += 52;
    }

    if (p.rageTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERS.rage.icon, p.rageTimer / CONFIG.rageMs, POWERS.rage.color);
      x += 52;
    }

    if (p.focusTimer > 0) {
      drawPowerBadge(ctx, x, y, POWERS.focus.icon, p.focusTimer / CONFIG.focusMs, POWERS.focus.color);
    }
  }

  function drawOverlay(ctx, w, h) {
    if (!state.running && !state.gameOver && !state.victory) {
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
        "KNOCKED OUT",
        `Score ${Math.floor(state.score).toLocaleString()} • High ${state.highScore.toLocaleString()} • Press R`
      );
    }

    if (state.victory) {
      drawCenterBox(
        ctx,
        w,
        h,
        "CHAMPION",
        `Studio cleared • Score ${Math.floor(state.score).toLocaleString()} • Press R`
      );
    }
  }

  function drawStartOverlay(ctx, w, h) {
    ctx.save();

    const boxW = Math.min(356, w - 32);
    const boxH = 250;
    const x = state.camera.x + (w - boxW) / 2;
    const y = h * 0.29;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    roundRect(ctx, x, y, boxW, boxH, 30);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.34)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.gold;
    ctx.font = "1000 34px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("STUDIO", state.camera.x + w / 2, y + 58);

    ctx.fillStyle = CONFIG.colors.green;
    ctx.font = "1000 30px system-ui";
    ctx.fillText("SHOWDOWN", state.camera.x + w / 2, y + 92);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 14px system-ui";
    ctx.fillText("Move: WASD / Arrows / Swipe", state.camera.x + w / 2, y + 132);
    ctx.fillText("Attack: J/Z • Heavy: K/X • Special: L/C", state.camera.x + w / 2, y + 156);
    ctx.fillText("Block: Down/S • Dash: Shift", state.camera.x + w / 2, y + 180);

    ctx.fillStyle = CONFIG.colors.green;
    roundRect(ctx, state.camera.x + w / 2 - 108, y + 204, 216, 34, 999);
    ctx.fill();

    ctx.fillStyle = "#041006";
    ctx.font = "1000 13px system-ui";
    ctx.fillText("TAP TO FIGHT", state.camera.x + w / 2, y + 226);

    ctx.restore();
  }

  function drawCenterBox(ctx, w, h, title, subtitle) {
    ctx.save();

    const boxW = Math.min(370, w - 32);
    const boxH = 188;
    const x = state.camera.x + (w - boxW) / 2;
    const y = h * 0.35;

    ctx.fillStyle = "rgba(0,0,0,0.76)";
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fill();

    ctx.strokeStyle = "rgba(250,204,21,0.34)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle =
      title === "KNOCKED OUT"
        ? CONFIG.colors.red
        : title === "CHAMPION"
          ? CONFIG.colors.gold
          : CONFIG.colors.green;

    ctx.font = "1000 36px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(title, state.camera.x + w / 2, y + 72);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 14px system-ui";
    wrapText(ctx, subtitle, state.camera.x + w / 2, y + 112, boxW - 42, 20);

    ctx.restore();
  }

  function drawPill(ctx, x, y, text, color) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    roundRect(ctx, x, y, 144, 34, 999);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.38;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.font = "1000 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 72, y + 17);

    ctx.restore();
  }

  function drawBar(ctx, x, y, w, h, pct, color, label) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    roundRect(ctx, x, y, w, h, 999);
    ctx.fill();

    ctx.fillStyle = color;
    roundRect(ctx, x, y, w * clamp(pct, 0, 1), h, 999);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = "1000 9px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 6, y + h / 2);

    ctx.restore();
  }

  function drawPowerBadge(ctx, x, y, icon, pct, color) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.beginPath();
    ctx.arc(x + 21, y + 21, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 21, y + 21, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pct, 0, 1));
    ctx.stroke();

    ctx.font = "900 17px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x + 21, y + 22);

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
