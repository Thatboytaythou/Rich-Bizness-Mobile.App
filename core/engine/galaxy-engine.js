import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/galaxy-engine.js

   ADVANCED BREATHING GALAXY ENGINE
   Deep Universe + Dynamic Atmosphere
========================= */

export function createGalaxyEngine(ctx) {
  const {
    THREE,
    scene,
    motion,
    activityState
  } = ctx;

  let starField;
  let deepStars;
  let galaxyCloud;
  let galaxyGold;
  let nebulaLayer;
  let cosmicDust;
  let galaxyPulse;
  let floatingFog;
  let energyBands;

  let starsGeo;
  let deepGeo;
  let cloudGeo;
  let goldGeo;
  let dustGeo;

  let mounted = false;

  const breathing = {
    pulse: 0,
    intensity: 1,
    target: 1
  };

  const themeMap = {
    green: {
      galaxy: 0x00ff9d,
      gold: 0xfacc15,
      stars: 0x8fffd2,
      fog: 0x03110b,
      nebula: 0x00ff88
    },

    blue: {
      galaxy: 0x22d3ee,
      gold: 0xffffff,
      stars: 0x7dd3fc,
      fog: 0x020617,
      nebula: 0x3b82f6
    },

    purple: {
      galaxy: 0xa855f7,
      gold: 0xf472b6,
      stars: 0xe879f9,
      fog: 0x0a0214,
      nebula: 0xc084fc
    }
  };

  let currentTheme = "green";

  function mount() {
    if (mounted) return;

    buildStars();
    buildDeepStars();
    buildGalaxyClouds();
    buildNebula();
    buildCosmicDust();
    buildFloatingFog();
    buildEnergyBands();

    mounted = true;
  }

  function buildStars() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    const count = isMobile ? 6200 : 9800;

    starsGeo = new THREE.BufferGeometry();

    const positions = [];
    const colors = [];
    const sizes = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(320),
        THREE.MathUtils.randFloatSpread(220),
        THREE.MathUtils.randFloatSpread(260)
      );

      const tone = Math.random();

      if (tone > 0.82) {
        colors.push(1, 0.82, 0.2);
      } else if (tone > 0.5) {
        colors.push(0, 1, 0.65);
      } else {
        colors.push(0.4, 1, 0.9);
      }

      sizes.push(Math.random() * 1.6);
    }

    starsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    starsGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    starsGeo.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(sizes, 1)
    );

    starField = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        size: isMobile ? 0.08 : 0.11,
        transparent: true,
        opacity: 0.8,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    starField.position.z = -45;

    scene.add(starField);
  }

  function buildDeepStars() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    const count = isMobile ? 3200 : 5800;

    deepGeo = new THREE.BufferGeometry();

    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(520),
        THREE.MathUtils.randFloatSpread(320),
        THREE.MathUtils.randFloatSpread(420)
      );
    }

    deepGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    deepStars = new THREE.Points(
      deepGeo,
      new THREE.PointsMaterial({
        color: 0x0ffff0,
        size: isMobile ? 0.03 : 0.045,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    deepStars.position.z = -120;

    scene.add(deepStars);
  }

  function buildGalaxyClouds() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    const count = isMobile ? 7200 : 12000;

    cloudGeo = new THREE.BufferGeometry();
    goldGeo = new THREE.BufferGeometry();

    const greenPositions = [];
    const goldPositions = [];

    for (let i = 0; i < count; i += 1) {
      const radius = Math.random() * 110;

      const arm = i % 6;

      const angle =
        radius * 0.18 +
        arm * ((Math.PI * 2) / 6) +
        Math.random() * 0.8;

      const x = Math.cos(angle) * radius;
      const y =
        THREE.MathUtils.randFloatSpread(45) *
        (1 - radius / 160);

      const z = Math.sin(angle) * radius;

      if (Math.random() > 0.78) {
        goldPositions.push(x, y, z);
      } else {
        greenPositions.push(x, y, z);
      }
    }

    cloudGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(greenPositions, 3)
    );

    goldGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(goldPositions, 3)
    );

    galaxyCloud = new THREE.Points(
      cloudGeo,
      new THREE.PointsMaterial({
        color: 0x00ff9d,
        size: isMobile ? 0.11 : 0.14,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    galaxyGold = new THREE.Points(
      goldGeo,
      new THREE.PointsMaterial({
        color: 0xfacc15,
        size: isMobile ? 0.08 : 0.11,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    galaxyCloud.position.z = -12;
    galaxyGold.position.z = -10;

    scene.add(galaxyCloud);
    scene.add(galaxyGold);
  }

  function buildNebula() {
    const geo = new THREE.PlaneGeometry(260, 260);

    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    nebulaLayer = new THREE.Mesh(geo, mat);

    nebulaLayer.position.z = -140;

    scene.add(nebulaLayer);

    const pulseGeo = new THREE.SphereGeometry(42, 64, 64);

    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    galaxyPulse = new THREE.Mesh(pulseGeo, pulseMat);

    galaxyPulse.position.set(0, 0, -25);

    scene.add(galaxyPulse);
  }

  function buildCosmicDust() {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    const count = isMobile ? 2400 : 4200;

    dustGeo = new THREE.BufferGeometry();

    const positions = [];

    for (let i = 0; i < count; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(220),
        THREE.MathUtils.randFloatSpread(180),
        THREE.MathUtils.randFloatSpread(140)
      );
    }

    dustGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    cosmicDust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: isMobile ? 0.018 : 0.025,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    cosmicDust.position.z = -5;

    scene.add(cosmicDust);
  }

  function buildFloatingFog() {
    floatingFog = new THREE.Group();

    for (let i = 0; i < 18; i += 1) {
      const fog = new THREE.Mesh(
        new THREE.SphereGeometry(
          THREE.MathUtils.randFloat(4, 12),
          22,
          22
        ),

        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x00ff9d : 0xfacc15,
          transparent: true,
          opacity: 0.02,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      fog.position.set(
        THREE.MathUtils.randFloatSpread(90),
        THREE.MathUtils.randFloatSpread(40),
        THREE.MathUtils.randFloat(-80, -10)
      );

      fog.userData.speed =
        THREE.MathUtils.randFloat(0.001, 0.004);

      fog.userData.offset =
        Math.random() * Math.PI * 2;

      floatingFog.add(fog);
    }

    scene.add(floatingFog);
  }

  function buildEnergyBands() {
    energyBands = new THREE.Group();

    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          24 + i * 8,
          0.08,
          12,
          220
        ),

        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x00ff9d : 0xfacc15,
          transparent: true,
          opacity: 0.06,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / (2 + i * 0.2);
      ring.rotation.y = i * 0.5;

      energyBands.add(ring);
    }

    energyBands.position.z = -20;

    scene.add(energyBands);
  }

  function update(t) {
    breathing.target = activityState.liveActive ? 1.35 : 1;

    breathing.intensity +=
      (breathing.target - breathing.intensity) * 0.03;

    breathing.pulse =
      Math.sin(t * 1.8) * 0.5 + 0.5;

    const breathe =
      1 +
      breathing.pulse *
        0.045 *
        breathing.intensity;

    if (starField) {
      starField.rotation.y +=
        0.00045 * breathing.intensity;

      starField.rotation.z =
        Math.sin(t * 0.12) * 0.03;

      starField.material.opacity =
        0.7 +
        breathing.pulse * 0.12;
    }

    if (deepStars) {
      deepStars.rotation.y -= 0.00012;
      deepStars.rotation.x =
        Math.sin(t * 0.05) * 0.02;
    }

    if (galaxyCloud) {
      galaxyCloud.rotation.y +=
        0.0012 * breathing.intensity;

      galaxyCloud.rotation.z =
        Math.sin(t * 0.16) * 0.04;

      galaxyCloud.scale.setScalar(breathe);

      galaxyCloud.material.opacity =
        0.52 +
        breathing.pulse * 0.16;
    }

    if (galaxyGold) {
      galaxyGold.rotation.y -=
        0.00082 * breathing.intensity;

      galaxyGold.scale.setScalar(
        1 + breathing.pulse * 0.03
      );

      galaxyGold.material.opacity =
        0.34 +
        breathing.pulse * 0.12;
    }

    if (nebulaLayer) {
      nebulaLayer.rotation.z += 0.0004;

      nebulaLayer.material.opacity =
        0.04 +
        breathing.pulse * 0.03;
    }

    if (galaxyPulse) {
      galaxyPulse.scale.setScalar(
        1 +
          breathing.pulse *
            0.08 *
            breathing.intensity
      );

      galaxyPulse.material.opacity =
        0.04 +
        breathing.pulse * 0.04;
    }

    if (cosmicDust) {
      cosmicDust.rotation.y += 0.0003;
      cosmicDust.rotation.x += 0.00008;
    }

    if (floatingFog) {
      floatingFog.children.forEach((fog, index) => {
        fog.position.x += fog.userData.speed;

        fog.position.y =
          Math.sin(
            t * 0.4 +
              fog.userData.offset +
              index
          ) * 8;

        fog.rotation.z += 0.0008;

        if (fog.position.x > 60) {
          fog.position.x = -60;
        }

        fog.material.opacity =
          0.012 +
          Math.sin(t * 0.5 + index) * 0.01;
      });
    }

    if (energyBands) {
      energyBands.children.forEach((ring, index) => {
        ring.rotation.z +=
          (0.0012 + index * 0.0008) *
          (index % 2 ? -1 : 1);

        ring.rotation.y += 0.0008;

        ring.material.opacity =
          0.04 +
          Math.sin(t * 0.8 + index) * 0.02;
      });
    }
  }

  function onActivityUpdate(state) {
    if (!galaxyCloud) return;

    galaxyCloud.material.opacity =
      state.liveActive ? 0.72 : 0.58;

    galaxyGold.material.opacity =
      state.liveActive ? 0.58 : 0.4;
  }

  function onPresenceUpdate(state) {
    if (!starField) return;

    starField.material.opacity =
      state.onlineCount > 0 ? 0.92 : 0.78;
  }

  function setTheme(theme = "green") {
    currentTheme = theme;

    const colors =
      themeMap[theme] || themeMap.green;

    if (galaxyCloud) {
      galaxyCloud.material.color.set(colors.galaxy);
    }

    if (galaxyGold) {
      galaxyGold.material.color.set(colors.gold);
    }

    if (deepStars) {
      deepStars.material.color.set(colors.stars);
    }

    if (nebulaLayer) {
      nebulaLayer.material.color.set(colors.nebula);
    }

    if (galaxyPulse) {
      galaxyPulse.material.color.set(colors.galaxy);
    }

    scene.fog.color.set(colors.fog);
  }

  function resize() {
    if (!starField) return;

    const isMobile =
      window.innerWidth <= motion.mobileBreakpoint;

    starField.material.size =
      isMobile ? 0.08 : 0.11;

    deepStars.material.size =
      isMobile ? 0.03 : 0.045;

    galaxyCloud.material.size =
      isMobile ? 0.11 : 0.14;

    galaxyGold.material.size =
      isMobile ? 0.08 : 0.11;

    cosmicDust.material.size =
      isMobile ? 0.018 : 0.025;
  }

  function destroy() {
    [
      starField,
      deepStars,
      galaxyCloud,
      galaxyGold,
      nebulaLayer,
      cosmicDust,
      galaxyPulse,
      floatingFog,
      energyBands
    ].forEach((obj) => {
      if (obj) scene.remove(obj);
    });

    starsGeo?.dispose?.();
    deepGeo?.dispose?.();
    cloudGeo?.dispose?.();
    goldGeo?.dispose?.();
    dustGeo?.dispose?.();

    mounted = false;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    setTheme,
    onActivityUpdate,
    onPresenceUpdate
  };
}
