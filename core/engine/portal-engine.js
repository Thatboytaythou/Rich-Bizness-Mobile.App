/* =========================
   RICH BIZNESS MOBILE
   /core/engine/portal-engine.js

   UNIVERSAL ULTRA 4K LIVING PORTAL ENGINE
========================= */

export function createPortalEngine(ctx) {
  const {
    THREE,
    scene,
    camera,
    renderer,
    motion,
    activityState
  } = ctx;

  let portal;
  let core;
  let innerCore;
  let mouth;
  let mist;
  let storm;
  let tunnel;
  let lens;
  let gravityWell;
  let eventHorizon;

  const rings = [];
  const streams = [];
  const sparks = [];
  const waves = [];
  const lightning = [];
  const touchBursts = [];

  let mounted = false;
  let themeIndex = 0;
  let touchPower = 0;
  let targetTouchPower = 0;

  const themes = [
    {
      name: "green",
      primary: 0x00ff9d,
      secondary: 0xfacc15,
      core: 0x00ffd5,
      fog: 0x03110b
    },
    {
      name: "blue",
      primary: 0x22d3ee,
      secondary: 0x93c5fd,
      core: 0x7dd3fc,
      fog: 0x020617
    },
    {
      name: "purple",
      primary: 0xa855f7,
      secondary: 0xf472b6,
      core: 0xe879f9,
      fog: 0x0b0214
    }
  ];

  function getTheme() {
    return themes[themeIndex % themes.length];
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
    g.addColorStop(0.12, "rgba(250,204,21,.9)");
    g.addColorStop(0.34, "rgba(0,255,157,.72)");
    g.addColorStop(0.62, "rgba(0,255,213,.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
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
      image.data[i + 3] = Math.random() * 90;
    }

    ctx2d.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function mount() {
    if (mounted) return;

    portal = new THREE.Group();
    portal.position.set(0, -1.12, -1.9);
    portal.renderOrder = 2;

    buildMist();
    buildGravityWell();
    buildTunnel();
    buildMouth();
    buildCore();
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
    const texture = makeGlowTexture();

    mist = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    mist.scale.set(31, 31, 1);
    portal.add(mist);

    storm = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeNoiseTexture(),
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    storm.scale.set(28, 28, 1);
    portal.add(storm);
  }

  function buildGravityWell() {
    gravityWell = new THREE.Mesh(
      new THREE.SphereGeometry(8.8, 96, 96),
      new THREE.MeshBasicMaterial({
        color: getTheme().primary,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    portal.add(gravityWell);

    eventHorizon = new THREE.Mesh(
      new THREE.TorusGeometry(6.4, 0.72, 32, 220),
      new THREE.MeshBasicMaterial({
        color: getTheme().core,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    eventHorizon.rotation.x = Math.PI / 2.65;
    eventHorizon.rotation.z = 0.18;
    portal.add(eventHorizon);
  }

  function buildTunnel() {
    tunnel = new THREE.Group();

    for (let i = 0; i < 9; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2 + i * 0.75, 0.035, 12, 180),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.2 - i * 0.014,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.position.z = -i * 0.72;
      ring.rotation.x = Math.PI / 2.25;
      ring.rotation.y = i * 0.22;
      ring.rotation.z = i * 0.3;

      tunnel.add(ring);
    }

    portal.add(tunnel);
  }

  function buildMouth() {
    mouth = new THREE.Mesh(
      new THREE.TorusGeometry(7.25, 0.42, 28, 240),
      new THREE.MeshBasicMaterial({
        color: getTheme().primary,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    mouth.rotation.x = Math.PI / 2.72;
    mouth.rotation.z = 0.12;

    portal.add(mouth);
  }

  function buildCore() {
    core = new THREE.Mesh(
      new THREE.SphereGeometry(6.15, 128, 128),
      new THREE.MeshPhongMaterial({
        color: getTheme().primary,
        emissive: getTheme().primary,
        emissiveIntensity: 1.35,
        shininess: 140,
        transparent: true,
        opacity: 0.76
      })
    );

    portal.add(core);

    innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(3.35, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    portal.add(innerCore);
  }

  function buildRings() {
    for (let i = 0; i < 8; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(8.2 + i * 0.82, 0.035 + i * 0.005, 12, 240),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.16 - i * 0.011,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / (2.12 + i * 0.12);
      ring.rotation.y = i * 0.42;
      ring.rotation.z = i * 0.75;

      ring.userData = {
        speed: 0.002 + i * 0.0008,
        drift: Math.random() * Math.PI * 2,
        baseOpacity: 0.16 - i * 0.011
      };

      rings.push(ring);
      portal.add(ring);
    }
  }

  function buildStreams() {
    for (let s = 0; s < 4; s += 1) {
      const geo = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];

      const count = 900;

      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = THREE.MathUtils.randFloat(0.45, 9.8);
        const pull = Math.pow(Math.random(), 1.7);

        positions.push(
          Math.cos(a) * r * pull,
          THREE.MathUtils.randFloatSpread(8),
          Math.sin(a) * r - THREE.MathUtils.randFloat(0, 12)
        );

        if (Math.random() > 0.62) {
          colors.push(1, 0.78, 0.12);
        } else {
          colors.push(0, 1, 0.62);
        }
      }

      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );

      geo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
      );

      const stream = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.1 + s * 0.015,
          transparent: true,
          opacity: 0.55,
          vertexColors: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      stream.rotation.z = s * Math.PI * 0.5;

      stream.userData = {
        speed: 0.003 + s * 0.001,
        pulse: Math.random() * Math.PI * 2
      };

      streams.push(stream);
      portal.add(stream);
    }
  }

  function buildSparks() {
    const texture = makeGlowTexture(256);

    for (let i = 0; i < 56; i += 1) {
      const spark = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      spark.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: THREE.MathUtils.randFloat(6, 18),
        y: THREE.MathUtils.randFloat(-6, 6),
        speed: THREE.MathUtils.randFloat(0.004, 0.018),
        lift: THREE.MathUtils.randFloat(-0.02, 0.02),
        size: THREE.MathUtils.randFloat(0.35, 1.3)
      };

      spark.scale.setScalar(spark.userData.size);

      sparks.push(spark);
      portal.add(spark);
    }
  }

  function buildWaves() {
    for (let i = 0; i < 5; i += 1) {
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(5 + i * 1.55, 0.025, 10, 220),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      wave.rotation.x = Math.PI / 2;
      wave.userData = {
        base: 5 + i * 1.55,
        speed: 0.55 + i * 0.18,
        offset: Math.random() * Math.PI * 2
      };

      waves.push(wave);
      portal.add(wave);
    }
  }

  function buildLightning() {
    for (let i = 0; i < 12; i += 1) {
      const geo = new THREE.BufferGeometry();

      const points = [];

      for (let p = 0; p < 6; p += 1) {
        points.push(
          new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(10),
            THREE.MathUtils.randFloatSpread(7),
            THREE.MathUtils.randFloat(-3, 3)
          )
        );
      }

      geo.setFromPoints(points);

      const bolt = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: i % 2 ? getTheme().secondary : getTheme().primary,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending
        })
      );

      bolt.userData = {
        flashAt: Math.random() * 8,
        life: 0
      };

      lightning.push(bolt);
      portal.add(bolt);
    }
  }

  function buildLens() {
    lens = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    lens.position.z = 0.2;
    portal.add(lens);
  }

  function bindTouch() {
    window.addEventListener(
      "pointerdown",
      (event) => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;

        if (Math.abs(x) < 0.34 && Math.abs(y) < 0.34) {
          pulseTouch();
        }
      },
      { passive: true }
    );
  }

  function pulseTouch() {
    targetTouchPower = 1.7;
    themeIndex += 1;
    applyTheme();

    const texture = makeGlowTexture(256);

    for (let i = 0; i < 18; i += 1) {
      const burst = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      const angle = Math.random() * Math.PI * 2;

      burst.position.set(
        Math.cos(angle) * THREE.MathUtils.randFloat(1, 5),
        Math.sin(angle) * THREE.MathUtils.randFloat(1, 4),
        THREE.MathUtils.randFloat(-2, 2)
      );

      burst.scale.setScalar(THREE.MathUtils.randFloat(0.7, 2.2));

      burst.userData = {
        angle,
        speed: THREE.MathUtils.randFloat(0.12, 0.34),
        life: 1,
        grow: THREE.MathUtils.randFloat(0.04, 0.1)
      };

      touchBursts.push(burst);
      portal.add(burst);
    }
  }

  function applyTheme() {
    const theme = getTheme();

    if (scene.fog) scene.fog.color.set(theme.fog);

    [
      mouth,
      core,
      eventHorizon,
      gravityWell
    ].forEach((obj) => {
      if (obj?.material?.color) obj.material.color.set(theme.primary);
      if (obj?.material?.emissive) obj.material.emissive.set(theme.primary);
    });

    rings.forEach((ring, index) => {
      ring.material.color.set(
        index % 2 ? theme.secondary : theme.primary
      );
    });

    waves.forEach((wave, index) => {
      wave.material.color.set(
        index % 2 ? theme.secondary : theme.primary
      );
    });

    lightning.forEach((bolt, index) => {
      bolt.material.color.set(
        index % 2 ? theme.secondary : theme.primary
      );
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
      touchPower * 0.06;

    portal.rotation.y += 0.0028 * boost;
    portal.rotation.x = Math.sin(t * 0.42) * 0.045;
    portal.scale.setScalar(breathe);

    if (mist) {
      mist.rotation.z += 0.0024 * boost;
      mist.material.opacity =
        0.54 +
        Math.sin(t * 1.7) * 0.12 +
        touchPower * 0.16;

      mist.scale.set(
        31 + Math.sin(t * 1.3) * 2.7 + touchPower * 2,
        31 + Math.cos(t * 1.1) * 2.4 + touchPower * 2,
        1
      );
    }

    if (storm) {
      storm.rotation.z -= 0.0018 * boost;
      storm.material.opacity =
        0.08 +
        Math.sin(t * 2.6) * 0.025 +
        touchPower * 0.08;
    }

    if (gravityWell) {
      gravityWell.rotation.y -= 0.003 * boost;
      gravityWell.scale.setScalar(
        1 + Math.sin(t * 1.4) * 0.08 + touchPower * 0.1
      );
      gravityWell.material.opacity =
        0.045 + Math.sin(t * 1.8) * 0.02 + touchPower * 0.06;
    }

    if (eventHorizon) {
      eventHorizon.rotation.z += 0.009 * boost;
      eventHorizon.scale.setScalar(
        1 + Math.sin(t * 3.4) * 0.04 + touchPower * 0.08
      );
      eventHorizon.material.opacity =
        0.32 + Math.sin(t * 2.8) * 0.08 + touchPower * 0.2;
    }

    if (mouth) {
      mouth.rotation.z -= 0.007 * boost;
      mouth.rotation.y = Math.sin(t * 0.62) * 0.08;
      mouth.scale.setScalar(
        1 + Math.sin(t * 3.1) * 0.035 + touchPower * 0.06
      );
      mouth.material.opacity =
        0.5 + Math.sin(t * 2.5) * 0.08 + touchPower * 0.14;
    }

    if (core) {
      core.rotation.y -= 0.006 * boost;
      core.rotation.z += 0.003 * boost;
      core.material.opacity =
        0.68 + Math.sin(t * 2.9) * 0.07 + touchPower * 0.08;
      core.material.emissiveIntensity =
        1.15 + Math.sin(t * 3.2) * 0.24 + touchPower * 0.8;
    }

    if (innerCore) {
      innerCore.scale.setScalar(
        1 + Math.sin(t * 4.4) * 0.2 + touchPower * 0.12
      );
      innerCore.material.opacity =
        0.12 + Math.sin(t * 3.6) * 0.06 + touchPower * 0.18;
    }

    if (tunnel) {
      tunnel.children.forEach((ring, index) => {
        ring.rotation.z +=
          (0.008 + index * 0.002) *
          (index % 2 ? -1 : 1) *
          boost;

        ring.position.z =
          -index * 0.72 +
          Math.sin(t * 1.7 + index) * 0.18;

        ring.material.opacity =
          0.08 +
          Math.sin(t * 2 + index) * 0.04 +
          touchPower * 0.04;
      });
    }

    rings.forEach((ring, index) => {
      ring.rotation.z +=
        ring.userData.speed *
        (index % 2 ? -1 : 1) *
        boost;

      ring.rotation.y += 0.0012 * (index + 1) * boost;

      ring.scale.setScalar(
        1 +
          Math.sin(t * (1.2 + index * 0.15) + ring.userData.drift) *
            0.035 +
          touchPower * 0.035
      );

      ring.material.opacity = Math.max(
        0.02,
        ring.userData.baseOpacity +
          Math.sin(t * 1.7 + index) * 0.035 +
          touchPower * 0.04
      );
    });

    streams.forEach((stream, index) => {
      stream.rotation.z +=
        stream.userData.speed *
        (index % 2 ? -1 : 1) *
        boost;

      stream.rotation.y += 0.0018 * boost;

      stream.material.opacity =
        0.48 +
        Math.sin(t * 2.4 + stream.userData.pulse) * 0.12 +
        touchPower * 0.16;
    });

    sparks.forEach((spark, index) => {
      spark.userData.angle += spark.userData.speed * boost;

      const r =
        spark.userData.radius +
        Math.sin(t * 1.4 + index) * 1.5 +
        touchPower * 1.8;

      spark.position.set(
        Math.cos(spark.userData.angle) * r,
        spark.userData.y + Math.sin(t * 1.2 + index) * 1.6,
        Math.sin(spark.userData.angle) * 3.2
      );

      spark.scale.setScalar(
        spark.userData.size +
          Math.sin(t * 2 + index) * 0.16 +
          touchPower * 0.25
      );

      spark.material.opacity =
        0.12 +
        Math.sin(t * 2 + index) * 0.08 +
        touchPower * 0.12;
    });

    waves.forEach((wave, index) => {
      const expand =
        1 +
        Math.sin(t * wave.userData.speed + wave.userData.offset) *
          0.08 +
        touchPower * 0.12;

      wave.scale.setScalar(expand);

      wave.rotation.z +=
        0.003 * (index % 2 ? -1 : 1) * boost;

      wave.material.opacity =
        0.055 +
        Math.sin(t * 1.3 + index) * 0.035 +
        touchPower * 0.035;
    });

    lightning.forEach((bolt, index) => {
      bolt.userData.life -= 0.035;

      if (bolt.userData.life <= 0 && Math.random() < 0.018 + touchPower * 0.035) {
        bolt.userData.life = 1;

        const pts = [];

        for (let p = 0; p < 7; p += 1) {
          const a = (p / 6) * Math.PI * 2 + Math.random() * 0.5;

          pts.push(
            new THREE.Vector3(
              Math.cos(a) * THREE.MathUtils.randFloat(2, 8),
              THREE.MathUtils.randFloatSpread(6),
              Math.sin(a) * THREE.MathUtils.randFloat(1, 4)
            )
          );
        }

        bolt.geometry.dispose();
        bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      }

      bolt.material.opacity = Math.max(0, bolt.userData.life * 0.38);
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
      lens.rotation.z += 0.0012;
      lens.material.opacity =
        0.025 + Math.sin(t * 1.6) * 0.01 + touchPower * 0.03;
    }
  }

  function onActivityUpdate(state) {
    if (!portal) return;

    targetTouchPower = state.liveActive ? 0.7 : targetTouchPower;
  }

  function onPresenceUpdate(state) {
    if (!portal) return;

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
      isMobile ? -1.9 : -2.4
    );

    portal.scale.setScalar(isMobile ? 1 : 1.08);
  }

  function destroy() {
    if (!portal) return;

    scene.remove(portal);

    portal.traverse((obj) => {
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    });

    rings.length = 0;
    streams.length = 0;
    sparks.length = 0;
    waves.length = 0;
    lightning.length = 0;
    touchBursts.length = 0;

    portal = null;
    mounted = false;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    pulseTouch,
    setTheme(themeName) {
      const found = themes.findIndex((t) => t.name === themeName);
      if (found >= 0) {
        themeIndex = found;
        applyTheme();
      }
    },
    onActivityUpdate,
    onPresenceUpdate
  };
}
