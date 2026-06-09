/* =========================
   RICH BIZNESS MOBILE
   /core/engine/galaxy-engine.js

   ULTRA SPACE GALAXY ENGINE
   Deep Space + Nebula + Star Depth + Portal Energy Sync
   Safer theme aliases + texture cleanup
   XP Energy Sync Enabled
========================= */

export function createGalaxyEngine(ctx) {
  const { THREE, scene, motion, activityState } = ctx;

  let starField = null;
  let deepStars = null;
  let microStars = null;
  let galaxyCloud = null;
  let galaxyGold = null;
  let nebulaBack = null;
  let nebulaMid = null;
  let cosmicDust = null;
  let portalAura = null;
  let spaceFog = null;
  let energyBands = null;
  let meteorField = null;

  let mounted = false;
  let themeBound = false;

  const geos = [];
  const textures = new Set();

  const state = {
    theme: "green-gold",
    pulse: 0,
    intensity: 1,
    target: 1,
    touchEnergy: 0,
    xpEnergy: 1,
    xpPulse: 0,
    xpPercent: 0,
    level: 1,
    rank: "Biz Legend"
  };

  const themes = {
    green: {
      galaxy: 0x00ff9d,
      gold: 0xfacc15,
      stars: 0x8fffd2,
      nebula: 0x00ff88,
      fog: 0x03110b
    },
    "green-gold": {
      galaxy: 0x00ff9d,
      gold: 0xfacc15,
      stars: 0x8fffd2,
      nebula: 0x00ff88,
      fog: 0x03110b
    },
    default: {
      galaxy: 0x00ff9d,
      gold: 0xfacc15,
      stars: 0x8fffd2,
      nebula: 0x00ff88,
      fog: 0x03110b
    },
    blue: {
      galaxy: 0x38bdf8,
      gold: 0x93c5fd,
      stars: 0x7dd3fc,
      nebula: 0x2563eb,
      fog: 0x020617
    },
    "blue-electric": {
      galaxy: 0x38bdf8,
      gold: 0x93c5fd,
      stars: 0x7dd3fc,
      nebula: 0x2563eb,
      fog: 0x020617
    },
    purple: {
      galaxy: 0xa855f7,
      gold: 0xf472b6,
      stars: 0xe879f9,
      nebula: 0xc084fc,
      fog: 0x090015
    },
    "purple-pink": {
      galaxy: 0xa855f7,
      gold: 0xf472b6,
      stars: 0xe879f9,
      nebula: 0xc084fc,
      fog: 0x090015
    },
    "black-gold": {
      galaxy: 0x111827,
      gold: 0xfacc15,
      stars: 0xfff7cc,
      nebula: 0x8b5d00,
      fog: 0x020201
    },
    gold: {
      galaxy: 0x111827,
      gold: 0xfacc15,
      stars: 0xfff7cc,
      nebula: 0x8b5d00,
      fog: 0x020201
    },
    emerald: {
      galaxy: 0x00ff88,
      gold: 0x050805,
      stars: 0xd1fae5,
      nebula: 0x00ff9d,
      fog: 0x020805
    },
    "emerald-black": {
      galaxy: 0x00ff88,
      gold: 0x050805,
      stars: 0xd1fae5,
      nebula: 0x00ff9d,
      fog: 0x020805
    },
    royal: {
      galaxy: 0x1f2937,
      gold: 0xffd700,
      stars: 0xfff7cc,
      nebula: 0xfacc15,
      fog: 0x080604
    },
    "royal-gold": {
      galaxy: 0x1f2937,
      gold: 0xffd700,
      stars: 0xfff7cc,
      nebula: 0xfacc15,
      fog: 0x080604
    }
  };

  function rememberTexture(texture) {
    if (texture) textures.add(texture);
    return texture;
  }

  function currentTheme() {
    return themes[state.theme] || themes["green-gold"];
  }

  function normalizeTheme(theme = "green-gold") {
    return String(theme || "green-gold")
      .trim()
      .toLowerCase();
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function syncXpState(stateUpdate = activityState || {}) {
    const percent =
      stateUpdate.xpPercent ??
      stateUpdate.percent ??
      state.xpPercent ??
      0;

    const level =
      stateUpdate.level ??
      state.level ??
      1;

    state.xpPercent = Math.max(0, Math.min(100, Number(percent) || 0));
    state.level = Math.max(1, Number(level) || 1);
    state.rank = stateUpdate.rank || state.rank || "Biz Legend";

    state.xpEnergy =
      Number(stateUpdate.xpEnergy) ||
      1 +
        Math.min(0.45, state.xpPercent / 240) +
        Math.min(0.25, state.level / 100);

    if (stateUpdate.xp || stateUpdate.xpPercent || stateUpdate.level) {
      state.xpPulse = Math.max(state.xpPulse, 0.42);
      state.touchEnergy = Math.max(state.touchEnergy, 0.28);
    }
  }

  function mount() {
    if (mounted) return;

    syncXpState(activityState);

    buildDeepStars();
    buildStarField();
    buildMicroStars();
    buildGalaxyClouds();
    buildNebula();
    buildCosmicDust();
    buildPortalAura();
    buildSpaceFog();
    buildEnergyBands();
    buildMeteorField();
    bindThemeEvents();

    mounted = true;
  }

  function makeGlowTexture(size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const c = canvas.getContext("2d");
    const g = c.createRadialGradient(
      size / 2,
      size / 2,
      2,
      size / 2,
      size / 2,
      size / 2
    );

    g.addColorStop(0, "rgba(255,255,255,.75)");
    g.addColorStop(0.18, "rgba(250,204,21,.34)");
    g.addColorStop(0.42, "rgba(0,255,157,.22)");
    g.addColorStop(0.74, "rgba(56,189,248,.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    c.fillStyle = g;
    c.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    return rememberTexture(tex);
  }

  function makeCloudTexture(size = 768) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const c = canvas.getContext("2d");

    for (let i = 0; i < 90; i += 1) {
      const x = size / 2 + THREE.MathUtils.randFloatSpread(size * 0.58);
      const y = size / 2 + THREE.MathUtils.randFloatSpread(size * 0.42);
      const r = THREE.MathUtils.randFloat(36, 150);

      const g = c.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,.20)");
      g.addColorStop(0.32, "rgba(0,255,157,.105)");
      g.addColorStop(0.66, "rgba(250,204,21,.035)");
      g.addColorStop(1, "rgba(0,0,0,0)");

      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    return rememberTexture(tex);
  }

  function buildDeepStars() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;
    const count = isMobile ? 4200 : 7600;

    const geo = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(720),
        THREE.MathUtils.randFloatSpread(460),
        THREE.MathUtils.randFloatSpread(620) - 160
      );
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geos.push(geo);

    deepStars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: currentTheme().stars,
        size: isMobile ? 0.026 : 0.038,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    deepStars.position.z = -170;
    scene.add(deepStars);
  }

  function buildStarField() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;
    const count = isMobile ? 7600 : 12800;

    const geo = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(390),
        THREE.MathUtils.randFloatSpread(260),
        THREE.MathUtils.randFloatSpread(320) - 60
      );

      const tone = Math.random();

      if (tone > 0.82) colors.push(1, 0.82, 0.22);
      else if (tone > 0.46) colors.push(0.0, 1.0, 0.65);
      else colors.push(0.5, 0.95, 1);
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geos.push(geo);

    starField = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: isMobile ? 0.075 : 0.105,
        transparent: true,
        opacity: 0.78,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    starField.position.z = -48;
    scene.add(starField);
  }

  function buildMicroStars() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;
    const count = isMobile ? 2600 : 4800;

    const geo = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(240),
        THREE.MathUtils.randFloatSpread(170),
        THREE.MathUtils.randFloatSpread(150) - 20
      );
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geos.push(geo);

    microStars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: isMobile ? 0.012 : 0.018,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    scene.add(microStars);
  }

  function buildGalaxyClouds() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;
    const count = isMobile ? 9200 : 15800;

    const greenGeo = new THREE.BufferGeometry();
    const goldGeo = new THREE.BufferGeometry();
    const green = [];
    const gold = [];

    for (let i = 0; i < count; i += 1) {
      const radius = Math.pow(Math.random(), 0.72) * 145;
      const arm = i % 7;
      const angle =
        radius * 0.145 +
        arm * ((Math.PI * 2) / 7) +
        THREE.MathUtils.randFloatSpread(0.9);

      const ySoft = 1 - radius / 190;

      const x = Math.cos(angle) * radius;
      const y = THREE.MathUtils.randFloatSpread(56) * ySoft;
      const z = Math.sin(angle) * radius - 30;

      if (Math.random() > 0.76) gold.push(x, y, z);
      else green.push(x, y, z);
    }

    greenGeo.setAttribute("position", new THREE.Float32BufferAttribute(green, 3));
    goldGeo.setAttribute("position", new THREE.Float32BufferAttribute(gold, 3));
    geos.push(greenGeo, goldGeo);

    galaxyCloud = new THREE.Points(
      greenGeo,
      new THREE.PointsMaterial({
        color: currentTheme().galaxy,
        size: isMobile ? 0.11 : 0.15,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    galaxyGold = new THREE.Points(
      goldGeo,
      new THREE.PointsMaterial({
        color: currentTheme().gold,
        size: isMobile ? 0.084 : 0.118,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    galaxyCloud.position.z = -16;
    galaxyGold.position.z = -14;

    scene.add(galaxyCloud);
    scene.add(galaxyGold);
  }

  function buildNebula() {
    const tex = makeCloudTexture();

    nebulaBack = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    nebulaBack.position.set(0, 18, -150);
    nebulaBack.scale.set(270, 190, 1);
    scene.add(nebulaBack);

    nebulaMid = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    nebulaMid.position.set(0, -4, -62);
    nebulaMid.scale.set(210, 150, 1);
    scene.add(nebulaMid);
  }

  function buildCosmicDust() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;
    const count = isMobile ? 3200 : 6200;

    const geo = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(260),
        THREE.MathUtils.randFloatSpread(200),
        THREE.MathUtils.randFloatSpread(180)
      );
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geos.push(geo);

    cosmicDust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: isMobile ? 0.015 : 0.022,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    cosmicDust.position.z = -8;
    scene.add(cosmicDust);
  }

  function buildPortalAura() {
    portalAura = new THREE.Mesh(
      new THREE.SphereGeometry(48, 96, 96),
      new THREE.MeshBasicMaterial({
        color: currentTheme().nebula,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    portalAura.position.set(0, -1, -24);
    scene.add(portalAura);
  }

  function buildSpaceFog() {
    spaceFog = new THREE.Group();

    const tex = makeCloudTexture(512);

    for (let i = 0; i < 26; i += 1) {
      const fog = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.045 + Math.random() * 0.05,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      fog.position.set(
        THREE.MathUtils.randFloatSpread(130),
        THREE.MathUtils.randFloatSpread(74),
        THREE.MathUtils.randFloat(-120, -12)
      );

      const s = THREE.MathUtils.randFloat(18, 46);
      fog.scale.set(s * 1.7, s, 1);

      fog.userData = {
        speed: THREE.MathUtils.randFloat(0.001, 0.004),
        float: Math.random() * Math.PI * 2,
        drift: THREE.MathUtils.randFloat(-0.008, 0.008)
      };

      spaceFog.add(fog);
    }

    scene.add(spaceFog);
  }

  function buildEnergyBands() {
    energyBands = new THREE.Group();

    for (let i = 0; i < 7; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(28 + i * 9, 0.05, 12, 260),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? currentTheme().gold : currentTheme().galaxy,
          transparent: true,
          opacity: 0.07 - i * 0.005,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / (2.08 + i * 0.16);
      ring.rotation.y = i * 0.42;
      ring.rotation.z = i * 0.62;
      ring.userData.speed = 0.0007 + i * 0.00034;

      energyBands.add(ring);
    }

    energyBands.position.z = -26;
    scene.add(energyBands);
  }

  function buildMeteorField() {
    meteorField = new THREE.Group();

    const tex = makeGlowTexture(256);

    for (let i = 0; i < 22; i += 1) {
      const meteor = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      meteor.position.set(
        THREE.MathUtils.randFloatSpread(160),
        THREE.MathUtils.randFloatSpread(95),
        THREE.MathUtils.randFloat(-110, -20)
      );

      meteor.scale.set(
        THREE.MathUtils.randFloat(1.6, 4.8),
        THREE.MathUtils.randFloat(0.25, 0.7),
        1
      );

      meteor.userData = {
        speed: THREE.MathUtils.randFloat(0.035, 0.12),
        resetX: THREE.MathUtils.randFloat(80, 130),
        resetY: THREE.MathUtils.randFloat(35, 72),
        glow: Math.random() * Math.PI * 2
      };

      meteor.rotation.z = -0.55;

      meteorField.add(meteor);
    }

    scene.add(meteorField);
  }

  function bindThemeEvents() {
    if (themeBound) return;
    themeBound = true;

    window.addEventListener("rb:portal-theme-change", onPortalThemeChange);
    window.addEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
    window.addEventListener("rb:app-xp-update", onXpGaugeUpdate);
    window.addEventListener("rb:universe-preview-update", onUniverseUpdate);
  }

  function unbindThemeEvents() {
    if (!themeBound) return;
    themeBound = false;

    window.removeEventListener("rb:portal-theme-change", onPortalThemeChange);
    window.removeEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
    window.removeEventListener("rb:app-xp-update", onXpGaugeUpdate);
    window.removeEventListener("rb:universe-preview-update", onUniverseUpdate);
  }

  function onPortalThemeChange(event) {
    const name = event.detail?.name || event.detail?.theme;

    if (name) {
      setTheme(name);
    }

    state.touchEnergy = 1;
  }

  function onXpGaugeUpdate(event) {
    syncXpState(event.detail || {});
  }

  function onUniverseUpdate(event) {
    syncXpState(event.detail?.activityState || {});
  }

  function update(t) {
    syncXpState(activityState);

    state.target = activityState.liveActive ? 1.42 : 1;
    state.intensity += (state.target - state.intensity) * 0.035;
    state.touchEnergy *= 0.935;
    state.xpPulse *= 0.945;
    state.pulse = Math.sin(t * 1.7) * 0.5 + 0.5;

    const xpGlow = clamp01(state.xpPercent / 100);
    const xpEnergy = state.xpEnergy || 1;

    const breathe =
      1 +
      state.pulse * 0.055 * state.intensity +
      state.touchEnergy * 0.025 +
      state.xpPulse * 0.018;

    if (deepStars) {
      deepStars.rotation.y -= 0.0001 * xpEnergy;
      deepStars.rotation.x = Math.sin(t * 0.05) * 0.018;
      deepStars.material.opacity = 0.24 + state.pulse * 0.08 + xpGlow * 0.025;
    }

    if (starField) {
      starField.rotation.y += 0.00042 * state.intensity * xpEnergy;
      starField.rotation.z = Math.sin(t * 0.11) * 0.025;
      starField.material.opacity =
        0.68 +
        state.pulse * 0.18 +
        state.touchEnergy * 0.08 +
        state.xpPulse * 0.08 +
        xpGlow * 0.035;
    }

    if (microStars) {
      microStars.rotation.y -= 0.00022 * xpEnergy;
      microStars.material.opacity = 0.18 + state.pulse * 0.12 + xpGlow * 0.02;
    }

    if (galaxyCloud) {
      galaxyCloud.rotation.y += 0.00105 * state.intensity * xpEnergy;
      galaxyCloud.rotation.z = Math.sin(t * 0.14) * 0.045;
      galaxyCloud.scale.setScalar(breathe);
      galaxyCloud.material.opacity =
        0.5 +
        state.pulse * 0.2 +
        state.touchEnergy * 0.08 +
        state.xpPulse * 0.07;
    }

    if (galaxyGold) {
      galaxyGold.rotation.y -= 0.00078 * state.intensity * xpEnergy;
      galaxyGold.rotation.z = Math.cos(t * 0.12) * 0.028;
      galaxyGold.scale.setScalar(
        1 +
          state.pulse * 0.04 +
          state.touchEnergy * 0.025 +
          state.xpPulse * 0.02
      );
      galaxyGold.material.opacity =
        0.34 +
        state.pulse * 0.16 +
        state.touchEnergy * 0.08 +
        state.xpPulse * 0.07 +
        xpGlow * 0.03;
    }

    if (nebulaBack) {
      nebulaBack.rotation.z += 0.00018 * xpEnergy;
      nebulaBack.material.opacity =
        0.14 +
        state.pulse * 0.09 +
        state.touchEnergy * 0.08 +
        state.xpPulse * 0.04;
      nebulaBack.scale.set(
        270 + state.pulse * 14 + state.xpPulse * 7,
        190 + Math.cos(t * 0.8) * 10 + state.xpPulse * 4,
        1
      );
    }

    if (nebulaMid) {
      nebulaMid.rotation.z -= 0.00028 * xpEnergy;
      nebulaMid.material.opacity =
        0.1 +
        state.pulse * 0.08 +
        state.touchEnergy * 0.1 +
        state.xpPulse * 0.05;
      nebulaMid.scale.set(
        210 + Math.sin(t * 0.9) * 12 + state.xpPulse * 6,
        150 + state.pulse * 9 + state.xpPulse * 4,
        1
      );
    }

    if (portalAura) {
      portalAura.rotation.y += 0.0009 * xpEnergy;
      portalAura.scale.setScalar(
        1 +
          state.pulse * 0.1 +
          state.touchEnergy * 0.18 +
          state.xpPulse * 0.08 +
          xpGlow * 0.035
      );
      portalAura.material.opacity =
        0.032 +
        state.pulse * 0.035 +
        state.touchEnergy * 0.07 +
        state.xpPulse * 0.04;
    }

    if (cosmicDust) {
      cosmicDust.rotation.y += 0.00028 * xpEnergy;
      cosmicDust.rotation.x += 0.00008 * xpEnergy;
      cosmicDust.material.opacity = 0.16 + state.pulse * 0.08 + xpGlow * 0.025;
    }

    if (spaceFog) {
      spaceFog.children.forEach((fog, index) => {
        fog.position.x += fog.userData.speed * 5 * xpEnergy;
        fog.position.y += Math.sin(t * 0.4 + fog.userData.float + index) * 0.004;
        fog.position.z += fog.userData.drift;
        fog.rotation.z += 0.0006 * xpEnergy;

        if (fog.position.x > 80) fog.position.x = -80;
        if (fog.position.z > -8) fog.position.z = -120;

        fog.material.opacity =
          0.035 +
          Math.sin(t * 0.55 + index) * 0.018 +
          state.touchEnergy * 0.018 +
          state.xpPulse * 0.012;
      });
    }

    if (energyBands) {
      energyBands.children.forEach((ring, index) => {
        ring.rotation.z +=
          ring.userData.speed *
          (index % 2 ? -1 : 1) *
          state.intensity *
          xpEnergy;

        ring.rotation.y += 0.00055 * xpEnergy;

        ring.material.opacity =
          0.035 +
          Math.sin(t * 0.85 + index) * 0.02 +
          state.touchEnergy * 0.025 +
          state.xpPulse * 0.02 +
          xpGlow * 0.008;
      });
    }

    if (meteorField) {
      meteorField.children.forEach((meteor, index) => {
        meteor.position.x -= meteor.userData.speed * (1 + state.touchEnergy + state.xpPulse);
        meteor.position.y -= meteor.userData.speed * 0.42;

        meteor.material.opacity =
          0.08 +
          Math.sin(t * 2 + meteor.userData.glow + index) * 0.055 +
          state.touchEnergy * 0.08 +
          state.xpPulse * 0.06;

        if (meteor.position.x < -95 || meteor.position.y < -60) {
          meteor.position.x = meteor.userData.resetX;
          meteor.position.y = meteor.userData.resetY;
          meteor.position.z = THREE.MathUtils.randFloat(-120, -24);
        }
      });
    }
  }

  function onActivityUpdate(stateUpdate) {
    syncXpState(stateUpdate);

    if (stateUpdate.liveActive) {
      state.touchEnergy = Math.max(state.touchEnergy, 0.45);
    }

    if (stateUpdate.xp || stateUpdate.xpPercent || stateUpdate.level) {
      state.xpPulse = Math.max(state.xpPulse, 0.38);
    }
  }

  function onPresenceUpdate(stateUpdate) {
    syncXpState(stateUpdate);

    if (stateUpdate.onlineCount > 0) {
      state.touchEnergy = Math.max(state.touchEnergy, 0.25);
    }
  }

  function setActivityState(stateUpdate = {}) {
    syncXpState(stateUpdate);
  }

  function setTheme(theme = "green-gold") {
    const nextTheme = normalizeTheme(theme);

    state.theme = themes[nextTheme] ? nextTheme : "green-gold";

    const colors = currentTheme();

    if (scene.fog) scene.fog.color.set(colors.fog);
    if (galaxyCloud) galaxyCloud.material.color.set(colors.galaxy);
    if (galaxyGold) galaxyGold.material.color.set(colors.gold);
    if (deepStars) deepStars.material.color.set(colors.stars);
    if (portalAura) portalAura.material.color.set(colors.nebula);

    if (energyBands) {
      energyBands.children.forEach((ring, index) => {
        ring.material.color.set(index % 2 ? colors.gold : colors.galaxy);
      });
    }

    state.touchEnergy = 1;
  }

  function resize() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    if (starField) starField.material.size = isMobile ? 0.075 : 0.105;
    if (deepStars) deepStars.material.size = isMobile ? 0.026 : 0.038;
    if (microStars) microStars.material.size = isMobile ? 0.012 : 0.018;
    if (galaxyCloud) galaxyCloud.material.size = isMobile ? 0.11 : 0.15;
    if (galaxyGold) galaxyGold.material.size = isMobile ? 0.084 : 0.118;
    if (cosmicDust) cosmicDust.material.size = isMobile ? 0.015 : 0.022;
  }

  function disposeMaterial(material) {
    if (!material) return;

    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
      return;
    }

    material.dispose?.();
  }

  function removeAndDispose(obj) {
    if (!obj) return;

    scene.remove(obj);

    obj.traverse?.((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });

    obj.geometry?.dispose?.();
    disposeMaterial(obj.material);
  }

  function destroy() {
    unbindThemeEvents();

    [
      starField,
      deepStars,
      microStars,
      galaxyCloud,
      galaxyGold,
      nebulaBack,
      nebulaMid,
      cosmicDust,
      portalAura,
      spaceFog,
      energyBands,
      meteorField
    ].forEach(removeAndDispose);

    geos.forEach((geo) => geo.dispose?.());
    geos.length = 0;

    textures.forEach((texture) => texture.dispose?.());
    textures.clear();

    starField = null;
    deepStars = null;
    microStars = null;
    galaxyCloud = null;
    galaxyGold = null;
    nebulaBack = null;
    nebulaMid = null;
    cosmicDust = null;
    portalAura = null;
    spaceFog = null;
    energyBands = null;
    meteorField = null;

    mounted = false;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    setTheme,
    setActivityState,
    onActivityUpdate,
    onPresenceUpdate
  };
}
