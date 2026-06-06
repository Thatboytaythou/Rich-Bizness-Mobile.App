/* =========================
   RICH BIZNESS MOBILE
   /core/engine/portal-engine.js

   UNIVERSAL ULTRA 4K LIVING PORTAL ENGINE
   Hollow Portal + Smoke Rim + Lightning + Touch Color Shift
   Safer cleanup + external theme support
========================= */

export function createPortalEngine(ctx) {
  const {
    THREE,
    scene,
    motion,
    activityState
  } = ctx;

  let portal = null;
  let mist = null;
  let storm = null;
  let blackVoid = null;
  let whiteCore = null;
  let eventHorizon = null;
  let mouth = null;
  let lens = null;
  let tunnel = null;

  const rings = [];
  const streams = [];
  const sparks = [];
  const waves = [];
  const lightning = [];
  const rimFlames = [];
  const touchBursts = [];
  const textures = new Set();

  let mounted = false;
  let touchBound = false;
  let themeIndex = 0;
  let touchPower = 0;
  let targetTouchPower = 0;

  const themes = [
    {
      name: "green",
      alias: ["green-gold", "default"],
      primary: 0x00ff9d,
      secondary: 0xfacc15,
      core: 0xffffff,
      void: 0x020302,
      fog: 0x03110b
    },
    {
      name: "blue",
      alias: ["blue-electric", "electric"],
      primary: 0x38bdf8,
      secondary: 0x93c5fd,
      core: 0xffffff,
      void: 0x020617,
      fog: 0x020617
    },
    {
      name: "purple",
      alias: ["purple-pink", "pink"],
      primary: 0xa855f7,
      secondary: 0xf472b6,
      core: 0xffffff,
      void: 0x0b0214,
      fog: 0x090015
    },
    {
      name: "black-gold",
      alias: ["gold", "black"],
      primary: 0x050805,
      secondary: 0xfacc15,
      core: 0xfff7cc,
      void: 0x000000,
      fog: 0x020201
    },
    {
      name: "emerald",
      alias: ["emerald-black"],
      primary: 0x00ff88,
      secondary: 0x050805,
      core: 0xffffff,
      void: 0x000000,
      fog: 0x020805
    },
    {
      name: "royal",
      alias: ["royal-gold"],
      primary: 0x111827,
      secondary: 0xffd700,
      core: 0xffffff,
      void: 0x020302,
      fog: 0x080604
    }
  ];

  function rememberTexture(texture) {
    if (texture) textures.add(texture);
    return texture;
  }

  function getTheme() {
    return themes[themeIndex % themes.length];
  }

  function findThemeIndex(themeName = "") {
    const key = String(themeName || "").trim().toLowerCase();

    return themes.findIndex((theme) => {
      return theme.name === key || theme.alias?.includes(key);
    });
  }

  function makeGlowTexture(size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx2d = canvas.getContext("2d");
    const g = ctx2d.createRadialGradient(
      size / 2,
      size / 2,
      2,
      size / 2,
      size / 2,
      size / 2
    );

    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.12, "rgba(250,204,21,.92)");
    g.addColorStop(0.32, "rgba(0,255,157,.7)");
    g.addColorStop(0.62, "rgba(56,189,248,.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return rememberTexture(texture);
  }

  function makeSmokeTexture(size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx2d = canvas.getContext("2d");
    ctx2d.clearRect(0, 0, size, size);

    for (let i = 0; i < 58; i += 1) {
      const x = size / 2 + (Math.random() - 0.5) * 210;
      const y = size / 2 + (Math.random() - 0.5) * 210;
      const r = 18 + Math.random() * 90;

      const g = ctx2d.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,.34)");
      g.addColorStop(0.35, "rgba(120,255,220,.16)");
      g.addColorStop(0.7, "rgba(0,255,157,.055)");
      g.addColorStop(1, "rgba(0,0,0,0)");

      ctx2d.fillStyle = g;
      ctx2d.beginPath();
      ctx2d.arc(x, y, r, 0, Math.PI * 2);
      ctx2d.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return rememberTexture(texture);
  }

  function makeNoiseTexture(size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx2d = canvas.getContext("2d");
    const image = ctx2d.createImageData(size, size);

    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.random() * 255;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = Math.random() * 76;
    }

    ctx2d.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return rememberTexture(texture);
  }

  function mount() {
    if (mounted) return;

    portal = new THREE.Group();
    portal.position.set(0, -1.12, -2);
    portal.renderOrder = 2;

    buildMist();
    buildVoid();
    buildTunnel();
    buildMouth();
    buildCore();
    buildRimFlames();
    buildRings();
    buildStreams();
    buildSparks();
    buildWaves();
    buildLightning();
    buildLens();

    scene.add(portal);
    bindTouch();

    mounted = true;
  }

  function buildMist() {
    mist = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    mist.scale.set(36, 36, 1);
    portal.add(mist);

    storm = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeNoiseTexture(),
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    storm.scale.set(32, 32, 1);
    portal.add(storm);
  }

  function buildVoid() {
    blackVoid = new THREE.Mesh(
      new THREE.SphereGeometry(5.55, 96, 96),
      new THREE.MeshBasicMaterial({
        color: getTheme().void,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      })
    );

    blackVoid.scale.set(1.06, 1.06, 0.42);
    portal.add(blackVoid);

    eventHorizon = new THREE.Mesh(
      new THREE.TorusGeometry(6.9, 0.58, 34, 280),
      new THREE.MeshBasicMaterial({
        color: getTheme().primary,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    eventHorizon.rotation.x = Math.PI / 2.7;
    eventHorizon.rotation.z = 0.14;
    portal.add(eventHorizon);
  }

  function buildTunnel() {
    tunnel = new THREE.Group();

    for (let i = 0; i < 12; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2 + i * 0.62, 0.032, 14, 220),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.24 - i * 0.012,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.position.z = -i * 0.55;
      ring.rotation.x = Math.PI / 2.22;
      ring.rotation.y = i * 0.18;
      ring.rotation.z = i * 0.34;

      tunnel.add(ring);
    }

    portal.add(tunnel);
  }

  function buildMouth() {
    mouth = new THREE.Mesh(
      new THREE.TorusGeometry(7.45, 0.78, 36, 320),
      new THREE.MeshBasicMaterial({
        color: getTheme().primary,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    mouth.rotation.x = Math.PI / 2.72;
    mouth.rotation.z = 0.12;
    portal.add(mouth);
  }

  function buildCore() {
    whiteCore = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(256),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: getTheme().core
      })
    );

    whiteCore.scale.set(8.2, 8.2, 1);
    portal.add(whiteCore);
  }

  function buildRimFlames() {
    const smokeTexture = makeSmokeTexture();

    for (let i = 0; i < 42; i += 1) {
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smokeTexture,
          transparent: true,
          opacity: 0.18 + Math.random() * 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      const angle = (i / 42) * Math.PI * 2;
      const radius = 7.4 + Math.random() * 0.9;

      flame.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.66,
        THREE.MathUtils.randFloat(-1.6, 1.6)
      );

      const s = THREE.MathUtils.randFloat(2.1, 4.9);
      flame.scale.set(s * 1.25, s, 1);

      flame.userData = {
        angle,
        radius,
        spin: THREE.MathUtils.randFloat(0.001, 0.004),
        float: Math.random() * Math.PI * 2,
        baseOpacity: flame.material.opacity,
        size: s
      };

      rimFlames.push(flame);
      portal.add(flame);
    }
  }

  function buildRings() {
    for (let i = 0; i < 10; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(8.2 + i * 0.92, 0.032 + i * 0.004, 12, 280),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.18 - i * 0.012,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / (2.08 + i * 0.11);
      ring.rotation.y = i * 0.38;
      ring.rotation.z = i * 0.72;

      ring.userData = {
        speed: 0.0022 + i * 0.00072,
        drift: Math.random() * Math.PI * 2,
        baseOpacity: 0.18 - i * 0.012
      };

      rings.push(ring);
      portal.add(ring);
    }
  }

  function buildStreams() {
    for (let s = 0; s < 5; s += 1) {
      const geo = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      const count = 1100;

      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = THREE.MathUtils.randFloat(0.8, 10.4);
        const pull = Math.pow(Math.random(), 1.9);

        positions.push(
          Math.cos(a) * r * pull,
          Math.sin(a) * r * 0.72 * pull,
          THREE.MathUtils.randFloat(-8, 5)
        );

        if (Math.random() > 0.58) colors.push(1, 0.78, 0.12);
        else colors.push(0, 1, 0.72);
      }

      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      const stream = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.1 + s * 0.014,
          transparent: true,
          opacity: 0.58,
          vertexColors: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      stream.rotation.z = s * Math.PI * 0.42;

      stream.userData = {
        speed: 0.0034 + s * 0.001,
        pulse: Math.random() * Math.PI * 2
      };

      streams.push(stream);
      portal.add(stream);
    }
  }

  function buildSparks() {
    const texture = makeGlowTexture(256);

    for (let i = 0; i < 74; i += 1) {
      const spark = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      spark.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: THREE.MathUtils.randFloat(5, 20),
        y: THREE.MathUtils.randFloat(-7, 7),
        speed: THREE.MathUtils.randFloat(0.004, 0.02),
        size: THREE.MathUtils.randFloat(0.32, 1.38)
      };

      spark.scale.setScalar(spark.userData.size);

      sparks.push(spark);
      portal.add(spark);
    }
  }

  function buildWaves() {
    for (let i = 0; i < 7; i += 1) {
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(5.4 + i * 1.45, 0.022, 10, 260),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.115,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      wave.rotation.x = Math.PI / 2;
      wave.userData = {
        speed: 0.55 + i * 0.17,
        offset: Math.random() * Math.PI * 2
      };

      waves.push(wave);
      portal.add(wave);
    }
  }

  function buildLightning() {
    for (let i = 0; i < 18; i += 1) {
      const bolt = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending
        })
      );

      bolt.userData = {
        life: 0,
        index: i
      };

      lightning.push(bolt);
      portal.add(bolt);
    }
  }

  function buildLens() {
    lens = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.03,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    lens.position.z = 0.35;
    portal.add(lens);
  }

  function bindTouch() {
    if (touchBound) return;
    touchBound = true;

    window.addEventListener("pointerdown", handlePortalPointerDown, {
      passive: true
    });
  }

  function unbindTouch() {
    if (!touchBound) return;
    touchBound = false;

    window.removeEventListener("pointerdown", handlePortalPointerDown);
  }

  function handlePortalPointerDown(event) {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    if (Math.abs(x) < 0.36 && Math.abs(y) < 0.36) {
      pulseTouch();
    }
  }

  function pulseTouch() {
    if (!portal) return;

    targetTouchPower = 1.9;
    themeIndex += 1;
    applyTheme();

    const texture = makeGlowTexture(256);

    for (let i = 0; i < 26; i += 1) {
      const burst = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      const angle = Math.random() * Math.PI * 2;

      burst.position.set(
        Math.cos(angle) * THREE.MathUtils.randFloat(1, 6),
        Math.sin(angle) * THREE.MathUtils.randFloat(1, 5),
        THREE.MathUtils.randFloat(-2.5, 2.5)
      );

      burst.scale.setScalar(THREE.MathUtils.randFloat(0.8, 2.6));

      burst.userData = {
        angle,
        speed: THREE.MathUtils.randFloat(0.14, 0.38),
        life: 1,
        grow: THREE.MathUtils.randFloat(0.04, 0.11)
      };

      touchBursts.push(burst);
      portal.add(burst);
    }

    window.dispatchEvent(
      new CustomEvent("rb:portal-theme-change", {
        detail: getTheme()
      })
    );
  }

  function applyTheme() {
    const theme = getTheme();

    if (scene.fog) scene.fog.color.set(theme.fog);

    [mouth, eventHorizon].forEach((obj) => {
      if (obj?.material?.color) obj.material.color.set(theme.primary);
    });

    if (blackVoid?.material?.color) {
      blackVoid.material.color.set(theme.void);
    }

    if (whiteCore?.material?.color) {
      whiteCore.material.color.set(theme.core);
    }

    rings.forEach((ring, index) => {
      ring.material.color.set(index % 2 ? theme.secondary : theme.primary);
    });

    waves.forEach((wave, index) => {
      wave.material.color.set(index % 2 ? theme.secondary : theme.primary);
    });

    lightning.forEach((bolt, index) => {
      bolt.material.color.set(index % 2 ? theme.secondary : theme.primary);
    });
  }

  function update(t) {
    if (!portal) return;

    const boost = activityState.portalBoost || 1;

    targetTouchPower *= 0.92;
    touchPower += (targetTouchPower - touchPower) * 0.08;

    const breathe =
      1 +
      Math.sin(t * 2.05) *
        (motion.portal?.scalePulse || 0.07) *
        boost +
      touchPower * 0.055;

    portal.rotation.y += 0.0025 * boost;
    portal.rotation.x = Math.sin(t * 0.38) * 0.04;
    portal.scale.setScalar(breathe);

    if (mist) {
      mist.rotation.z += 0.0024 * boost;
      mist.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.12 + touchPower * 0.14;
      mist.scale.set(
        36 + Math.sin(t * 1.3) * 3.4 + touchPower * 3,
        36 + Math.cos(t * 1.1) * 3.1 + touchPower * 3,
        1
      );
    }

    if (storm) {
      storm.rotation.z -= 0.0021 * boost;
      storm.material.opacity = 0.1 + Math.sin(t * 2.6) * 0.035 + touchPower * 0.09;
    }

    if (blackVoid) {
      blackVoid.rotation.y -= 0.004 * boost;
      blackVoid.scale.set(
        1.06 + Math.sin(t * 1.4) * 0.04,
        1.06 + Math.cos(t * 1.2) * 0.04,
        0.42
      );
      blackVoid.material.opacity = 0.74 + Math.sin(t * 2.2) * 0.06;
    }

    if (eventHorizon) {
      eventHorizon.rotation.z += 0.011 * boost;
      eventHorizon.scale.setScalar(1 + Math.sin(t * 3.4) * 0.045 + touchPower * 0.09);
      eventHorizon.material.opacity = 0.54 + Math.sin(t * 2.8) * 0.12 + touchPower * 0.2;
    }

    if (mouth) {
      mouth.rotation.z -= 0.008 * boost;
      mouth.rotation.y = Math.sin(t * 0.62) * 0.08;
      mouth.scale.setScalar(1 + Math.sin(t * 3.1) * 0.04 + touchPower * 0.065);
      mouth.material.opacity = 0.58 + Math.sin(t * 2.5) * 0.1 + touchPower * 0.16;
    }

    if (whiteCore) {
      whiteCore.rotation.z += 0.003 * boost;
      whiteCore.scale.set(
        8.2 + Math.sin(t * 4.4) * 0.8 + touchPower * 1.8,
        8.2 + Math.cos(t * 3.8) * 0.8 + touchPower * 1.8,
        1
      );
      whiteCore.material.opacity = 0.48 + Math.sin(t * 3.6) * 0.1 + touchPower * 0.22;
    }

    if (tunnel) {
      tunnel.children.forEach((ring, index) => {
        ring.rotation.z += (0.009 + index * 0.002) * (index % 2 ? -1 : 1) * boost;
        ring.position.z = -index * 0.55 + Math.sin(t * 1.7 + index) * 0.18;
        ring.material.opacity = 0.075 + Math.sin(t * 2 + index) * 0.04 + touchPower * 0.04;
      });
    }

    rimFlames.forEach((flame, index) => {
      flame.userData.angle += flame.userData.spin * boost;

      const r =
        flame.userData.radius +
        Math.sin(t * 1.4 + index) * 0.42 +
        touchPower * 0.7;

      flame.position.set(
        Math.cos(flame.userData.angle) * r,
        Math.sin(flame.userData.angle) * r * 0.68,
        Math.sin(t + index) * 1.8
      );

      const s =
        flame.userData.size +
        Math.sin(t * 1.8 + index) * 0.42 +
        touchPower * 0.58;

      flame.scale.set(s * 1.45, s, 1);

      flame.material.opacity =
        flame.userData.baseOpacity +
        Math.sin(t * 1.6 + index) * 0.06 +
        touchPower * 0.08;
    });

    rings.forEach((ring, index) => {
      ring.rotation.z += ring.userData.speed * (index % 2 ? -1 : 1) * boost;
      ring.rotation.y += 0.00125 * (index + 1) * boost;

      ring.scale.setScalar(
        1 +
          Math.sin(t * (1.2 + index * 0.15) + ring.userData.drift) * 0.04 +
          touchPower * 0.04
      );

      ring.material.opacity = Math.max(
        0.02,
        ring.userData.baseOpacity +
          Math.sin(t * 1.7 + index) * 0.04 +
          touchPower * 0.04
      );
    });

    streams.forEach((stream, index) => {
      stream.rotation.z += stream.userData.speed * (index % 2 ? -1 : 1) * boost;
      stream.rotation.y += 0.0019 * boost;

      stream.material.opacity =
        0.5 +
        Math.sin(t * 2.4 + stream.userData.pulse) * 0.14 +
        touchPower * 0.16;
    });

    sparks.forEach((spark, index) => {
      spark.userData.angle += spark.userData.speed * boost;

      const r =
        spark.userData.radius +
        Math.sin(t * 1.4 + index) * 1.6 +
        touchPower * 2;

      spark.position.set(
        Math.cos(spark.userData.angle) * r,
        spark.userData.y + Math.sin(t * 1.2 + index) * 1.7,
        Math.sin(spark.userData.angle) * 3.6
      );

      spark.scale.setScalar(
        spark.userData.size +
          Math.sin(t * 2 + index) * 0.16 +
          touchPower * 0.25
      );

      spark.material.opacity =
        0.13 +
        Math.sin(t * 2 + index) * 0.09 +
        touchPower * 0.12;
    });

    waves.forEach((wave, index) => {
      const expand =
        1 +
        Math.sin(t * wave.userData.speed + wave.userData.offset) * 0.08 +
        touchPower * 0.12;

      wave.scale.setScalar(expand);
      wave.rotation.z += 0.003 * (index % 2 ? -1 : 1) * boost;

      wave.material.opacity =
        0.055 +
        Math.sin(t * 1.3 + index) * 0.035 +
        touchPower * 0.035;
    });

    lightning.forEach((bolt) => {
      bolt.userData.life -= 0.04;

      if (bolt.userData.life <= 0 && Math.random() < 0.024 + touchPower * 0.04) {
        bolt.userData.life = 1;

        const pts = [];
        const start = Math.random() * Math.PI * 2;

        for (let p = 0; p < 8; p += 1) {
          const a = start + (p / 7) * Math.PI * 1.45 + Math.random() * 0.35;
          const r = THREE.MathUtils.randFloat(3.4, 8.8);

          pts.push(
            new THREE.Vector3(
              Math.cos(a) * r + THREE.MathUtils.randFloatSpread(0.7),
              Math.sin(a) * r * 0.68 + THREE.MathUtils.randFloatSpread(0.7),
              THREE.MathUtils.randFloat(-2.2, 2.2)
            )
          );
        }

        bolt.geometry.dispose();
        bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      }

      bolt.material.opacity = Math.max(0, bolt.userData.life * 0.52);
    });

    for (let i = touchBursts.length - 1; i >= 0; i -= 1) {
      const burst = touchBursts[i];

      burst.userData.life -= 0.018;

      burst.position.x += Math.cos(burst.userData.angle) * burst.userData.speed;
      burst.position.y += Math.sin(burst.userData.angle) * burst.userData.speed;
      burst.position.z += 0.04;

      burst.scale.x += burst.userData.grow;
      burst.scale.y += burst.userData.grow;

      burst.material.opacity *= 0.965;

      if (burst.userData.life <= 0 || burst.material.opacity <= 0.02) {
        portal.remove(burst);
        burst.material.dispose();
        touchBursts.splice(i, 1);
      }
    }

    if (lens) {
      lens.rotation.z += 0.0013;
      lens.material.opacity =
        0.025 +
        Math.sin(t * 1.6) * 0.014 +
        touchPower * 0.03;
    }
  }

  function onActivityUpdate(state) {
    if (state.liveActive) {
      targetTouchPower = Math.max(targetTouchPower, 0.7);
    }
  }

  function onPresenceUpdate(state) {
    if (state.onlineCount > 0) {
      targetTouchPower = Math.max(targetTouchPower, 0.35);
    }
  }

  function resize() {
    if (!portal) return;

    const isMobile = window.innerWidth <= 720;

    portal.position.set(
      0,
      isMobile ? -1.12 : -0.95,
      isMobile ? -2 : -2.4
    );

    portal.scale.setScalar(isMobile ? 1 : 1.08);
  }

  function destroy() {
    if (!portal) return;

    unbindTouch();

    scene.remove(portal);

    portal.traverse((obj) => {
      obj.geometry?.dispose?.();

      if (Array.isArray(obj.material)) {
        obj.material.forEach((material) => material.dispose?.());
      } else {
        obj.material?.dispose?.();
      }
    });

    textures.forEach((texture) => texture.dispose?.());
    textures.clear();

    rings.length = 0;
    streams.length = 0;
    sparks.length = 0;
    waves.length = 0;
    lightning.length = 0;
    rimFlames.length = 0;
    touchBursts.length = 0;

    portal = null;
    mist = null;
    storm = null;
    blackVoid = null;
    whiteCore = null;
    eventHorizon = null;
    mouth = null;
    lens = null;
    tunnel = null;

    mounted = false;
    touchPower = 0;
    targetTouchPower = 0;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    pulseTouch,

    setTheme(themeName) {
      const found = findThemeIndex(themeName);

      if (found >= 0) {
        themeIndex = found;
        applyTheme();
      }
    },

    onActivityUpdate,
    onPresenceUpdate
  };
}
