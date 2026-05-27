/* =========================
   RICH BIZNESS MOBILE
   /core/engine/omni-fx.js

   POWERHOUSE OMNI FX ENGINE
   Breathing FX • Shockwaves • Trails • Atmosphere • Portal Reactions
========================= */

export function createOmniFxEngine(ctx) {
  const {
    THREE,
    scene,
    camera,
    motion,
    activityState
  } = ctx;

  let fxRoot;
  let auraField;
  let cometField;
  let moneyDust;
  let shockwaveGroup;
  let dimensionalGrid;
  let lightLeaks;
  let portalReactionGroup;
  let mounted = false;

  const shockwaves = [];
  const comets = [];
  const leaks = [];
  const reactionBursts = [];

  let theme = "green";
  let breathePower = 1;
  let targetPower = 1;
  let touchPulse = 0;

  const themes = {
    green: {
      primary: 0x00ff9d,
      secondary: 0xfacc15,
      soft: 0x7cffaa
    },
    blue: {
      primary: 0x38bdf8,
      secondary: 0x93c5fd,
      soft: 0x67e8f9
    },
    purple: {
      primary: 0xa855f7,
      secondary: 0xf472b6,
      soft: 0xc084fc
    }
  };

  function colors() {
    return themes[theme] || themes.green;
  }

  function mount() {
    if (mounted) return;

    fxRoot = new THREE.Group();
    fxRoot.renderOrder = 110;
    scene.add(fxRoot);

    buildAuraField();
    buildComets();
    buildMoneyDust();
    buildShockwaveGroup();
    buildDimensionalGrid();
    buildLightLeaks();
    buildPortalReactionGroup();
    bindFxEvents();

    mounted = true;
  }

  function makeGlowTexture(size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx2d = canvas.getContext("2d");
    const g = ctx2d.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );

    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(250,204,21,.72)");
    g.addColorStop(0.44, "rgba(0,255,157,.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function buildAuraField() {
    auraField = new THREE.Group();

    for (let i = 0; i < 9; i += 1) {
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(10 + i * 4.8, 40, 40),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? colors().secondary : colors().primary,
          transparent: true,
          opacity: 0.018,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      aura.position.set(
        THREE.MathUtils.randFloatSpread(18),
        THREE.MathUtils.randFloatSpread(10),
        -8 - i * 4
      );

      aura.userData = {
        speed: 0.0007 + i * 0.0002,
        offset: Math.random() * Math.PI * 2
      };

      auraField.add(aura);
    }

    fxRoot.add(auraField);
  }

  function buildComets() {
    cometField = new THREE.Group();
    const texture = makeGlowTexture();

    for (let i = 0; i < 34; i += 1) {
      const comet = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      comet.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: THREE.MathUtils.randFloat(16, 52),
        y: THREE.MathUtils.randFloat(-18, 18),
        z: THREE.MathUtils.randFloat(-46, 8),
        speed: THREE.MathUtils.randFloat(0.002, 0.01),
        size: THREE.MathUtils.randFloat(0.45, 1.9)
      };

      comet.scale.setScalar(comet.userData.size);
      comets.push(comet);
      cometField.add(comet);
    }

    fxRoot.add(cometField);
  }

  function buildMoneyDust() {
    const count = window.innerWidth <= motion.mobileBreakpoint ? 900 : 1600;

    const geo = new THREE.BufferGeometry();
    const positions = [];
    const colorsArr = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(120),
        THREE.MathUtils.randFloatSpread(80),
        THREE.MathUtils.randFloat(-60, 20)
      );

      if (Math.random() > 0.62) {
        colorsArr.push(1, 0.78, 0.16);
      } else {
        colorsArr.push(0, 1, 0.62);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorsArr, 3));

    moneyDust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: window.innerWidth <= motion.mobileBreakpoint ? 0.055 : 0.075,
        transparent: true,
        opacity: 0.36,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    fxRoot.add(moneyDust);
  }

  function buildShockwaveGroup() {
    shockwaveGroup = new THREE.Group();
    fxRoot.add(shockwaveGroup);

    for (let i = 0; i < 3; i += 1) {
      const wave = createShockwave(0.08);
      wave.visible = false;
      shockwaves.push(wave);
      shockwaveGroup.add(wave);
    }
  }

  function createShockwave(opacity = 0.16) {
    return new THREE.Mesh(
      new THREE.TorusGeometry(2, 0.035, 10, 180),
      new THREE.MeshBasicMaterial({
        color: colors().primary,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
  }

  function buildDimensionalGrid() {
    dimensionalGrid = new THREE.Group();

    for (let i = 0; i < 6; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(18 + i * 7, 0.018, 8, 240),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? colors().secondary : colors().primary,
          transparent: true,
          opacity: 0.035,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / (2.55 + i * 0.08);
      ring.rotation.y = i * 0.26;
      ring.userData.speed = 0.0005 + i * 0.00025;

      dimensionalGrid.add(ring);
    }

    dimensionalGrid.position.z = -20;
    fxRoot.add(dimensionalGrid);
  }

  function buildLightLeaks() {
    lightLeaks = new THREE.Group();

    for (let i = 0; i < 10; i += 1) {
      const leak = new THREE.Mesh(
        new THREE.PlaneGeometry(
          THREE.MathUtils.randFloat(8, 22),
          THREE.MathUtils.randFloat(0.08, 0.22)
        ),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? colors().secondary : colors().primary,
          transparent: true,
          opacity: 0.05,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      leak.position.set(
        THREE.MathUtils.randFloatSpread(45),
        THREE.MathUtils.randFloatSpread(24),
        THREE.MathUtils.randFloat(-20, 4)
      );

      leak.rotation.z = Math.random() * Math.PI;
      leak.userData = {
        speed: THREE.MathUtils.randFloat(0.001, 0.004),
        offset: Math.random() * Math.PI * 2
      };

      leaks.push(leak);
      lightLeaks.add(leak);
    }

    fxRoot.add(lightLeaks);
  }

  function buildPortalReactionGroup() {
    portalReactionGroup = new THREE.Group();
    fxRoot.add(portalReactionGroup);
  }

  function bindFxEvents() {
    window.addEventListener("rb:portal-card-push", (event) => {
      triggerShockwave(0, -0.6, 2.4);
      triggerBurst(event.detail?.key || "portal");
    });

    window.addEventListener("rb:avatar-portal-jump", () => {
      triggerShockwave(0, -0.4, 2.6);
      triggerBurst("avatar");
    });

    window.addEventListener("pointerdown", (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      if (Math.abs(x) < 0.36 && Math.abs(y) < 0.36) {
        touchPulse = 1;
        triggerShockwave(0, -0.6, 2.2);
      }
    }, { passive: true });
  }

  function triggerShockwave(x = 0, y = 0, z = 2.2) {
    const wave = shockwaves.find((item) => !item.visible) || createShockwave();

    if (!wave.parent) shockwaveGroup.add(wave);

    wave.visible = true;
    wave.position.set(x, y, z);
    wave.scale.setScalar(0.35);
    wave.material.opacity = 0.22;
    wave.userData.life = 1;
  }

  function triggerBurst(type = "portal") {
    const texture = makeGlowTexture();
    const count = type === "avatar" ? 18 : 26;

    for (let i = 0; i < count; i += 1) {
      const burst = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(1, 5.2);

      burst.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius - 0.5,
        THREE.MathUtils.randFloat(0.4, 3.4)
      );

      burst.scale.setScalar(THREE.MathUtils.randFloat(0.45, 1.65));

      burst.userData = {
        life: 1,
        angle,
        speed: THREE.MathUtils.randFloat(0.035, 0.14),
        lift: THREE.MathUtils.randFloat(-0.02, 0.06),
        grow: THREE.MathUtils.randFloat(0.012, 0.055)
      };

      reactionBursts.push(burst);
      portalReactionGroup.add(burst);
    }
  }

  function update(t) {
    if (!mounted) return;

    targetPower = activityState.liveActive ? 1.35 : 1;
    breathePower += (targetPower - breathePower) * 0.025;
    touchPulse *= 0.92;

    updateAura(t);
    updateComets(t);
    updateMoneyDust(t);
    updateShockwaves(t);
    updateGrid(t);
    updateLightLeaks(t);
    updateBursts(t);
  }

  function updateAura(t) {
    auraField?.children.forEach((aura, index) => {
      aura.rotation.y += aura.userData.speed * breathePower;
      aura.rotation.z += aura.userData.speed * 0.6;

      const pulse = Math.sin(t * 1.2 + aura.userData.offset) * 0.5 + 0.5;

      aura.scale.setScalar(
        1 + pulse * 0.12 * breathePower + touchPulse * 0.18
      );

      aura.material.opacity =
        0.012 +
        pulse * 0.018 +
        touchPulse * 0.025 +
        (activityState.liveActive ? 0.01 : 0);
    });
  }

  function updateComets(t) {
    comets.forEach((comet, index) => {
      comet.userData.angle += comet.userData.speed * breathePower;

      const r =
        comet.userData.radius +
        Math.sin(t * 0.8 + index) * 2.3 +
        touchPulse * 3.2;

      comet.position.set(
        Math.cos(comet.userData.angle) * r,
        comet.userData.y + Math.sin(t * 1.4 + index) * 1.6,
        Math.sin(comet.userData.angle) * 7 + comet.userData.z
      );

      comet.scale.setScalar(
        comet.userData.size +
        Math.sin(t * 2 + index) * 0.18 +
        touchPulse * 0.24
      );

      comet.material.opacity =
        0.12 +
        Math.sin(t * 2.1 + index) * 0.06 +
        touchPulse * 0.16;
    });
  }

  function updateMoneyDust(t) {
    if (!moneyDust) return;

    moneyDust.rotation.y += 0.00045 * breathePower;
    moneyDust.rotation.x = Math.sin(t * 0.08) * 0.035;
    moneyDust.material.opacity =
      0.28 + Math.sin(t * 1.1) * 0.05 + touchPulse * 0.08;
  }

  function updateShockwaves(t) {
    shockwaves.forEach((wave) => {
      if (!wave.visible) return;

      wave.userData.life -= 0.018;
      wave.scale.multiplyScalar(1.035);
      wave.rotation.z += 0.008;
      wave.material.opacity *= 0.955;

      if (wave.userData.life <= 0 || wave.material.opacity <= 0.01) {
        wave.visible = false;
      }
    });
  }

  function updateGrid(t) {
    dimensionalGrid?.children.forEach((ring, index) => {
      ring.rotation.z += ring.userData.speed * (index % 2 ? -1 : 1);
      ring.rotation.y += 0.00045 * (index + 1);

      ring.material.opacity =
        0.022 +
        Math.sin(t * 0.9 + index) * 0.014 +
        touchPulse * 0.02;
    });
  }

  function updateLightLeaks(t) {
    leaks.forEach((leak, index) => {
      leak.position.x += leak.userData.speed * 4;

      if (leak.position.x > 34) {
        leak.position.x = -34;
      }

      leak.material.opacity =
        0.025 +
        Math.sin(t * 1.4 + leak.userData.offset) * 0.025 +
        touchPulse * 0.035;

      leak.scale.x =
        1 +
        Math.sin(t * 0.9 + index) * 0.12 +
        touchPulse * 0.2;
    });
  }

  function updateBursts(t) {
    for (let i = reactionBursts.length - 1; i >= 0; i -= 1) {
      const burst = reactionBursts[i];

      burst.userData.life -= 0.015;

      burst.position.x += Math.cos(burst.userData.angle) * burst.userData.speed;
      burst.position.y += Math.sin(burst.userData.angle) * burst.userData.speed + burst.userData.lift;
      burst.position.z += 0.025;

      burst.scale.x += burst.userData.grow;
      burst.scale.y += burst.userData.grow;

      burst.material.opacity *= 0.962;

      if (burst.userData.life <= 0 || burst.material.opacity <= 0.015) {
        portalReactionGroup.remove(burst);
        burst.material.dispose();
        reactionBursts.splice(i, 1);
      }
    }
  }

  function setTheme(next = "green") {
    theme = next;
    const c = colors();

    auraField?.children.forEach((aura, index) => {
      aura.material.color.setHex(index % 2 ? c.secondary : c.primary);
    });

    dimensionalGrid?.children.forEach((ring, index) => {
      ring.material.color.setHex(index % 2 ? c.secondary : c.primary);
    });

    leaks.forEach((leak, index) => {
      leak.material.color.setHex(index % 2 ? c.secondary : c.primary);
    });
  }

  function onActivityUpdate(state) {
    if (state.liveActive) {
      touchPulse = Math.max(touchPulse, 0.45);
    }
  }

  function onPresenceUpdate(state) {
    if (state.onlineCount > 0) {
      touchPulse = Math.max(touchPulse, 0.25);
    }
  }

  function resize() {
    if (!moneyDust) return;

    moneyDust.material.size =
      window.innerWidth <= motion.mobileBreakpoint ? 0.055 : 0.075;
  }

  function destroy() {
    if (!fxRoot) return;

    scene.remove(fxRoot);

    fxRoot.traverse((obj) => {
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    });

    shockwaves.length = 0;
    comets.length = 0;
    leaks.length = 0;
    reactionBursts.length = 0;

    mounted = false;
    fxRoot = null;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    setTheme,
    onActivityUpdate,
    onPresenceUpdate,
    triggerShockwave,
    triggerBurst
  };
}
