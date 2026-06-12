/* =========================
   RICH BIZNESS MOBILE
   /core/engine/portal-three.js

   Three.js Portal Layer
   - Mounts inside #threePortal
   - Does NOT handle routes
   - Does NOT move hotspots
   - Pure visual engine only
========================= */

(() => {
  const mount = document.getElementById("threePortal");

  if (!mount || !window.THREE) {
    return;
  }

  const THREE = window.THREE;

  let width = 1;
  let height = 1;
  let renderer;
  let scene;
  let camera;
  let portalGroup;
  let ringOuter;
  let ringMid;
  let ringInner;
  let core;
  let particles;
  let animationId = 0;

  const pointer = {
    x: 0,
    y: 0
  };

  function getPortalPosition() {
    const portrait =
      window.innerWidth <= 900 ||
      window.matchMedia("(orientation: portrait)").matches;

    return portrait
      ? { x: 0, y: -0.18, scale: 0.86 }
      : { x: 0, y: -0.06, scale: 1.0 };
  }

  function makeRingGeometry(radius, tube, radialSegments = 96, tubularSegments = 14) {
    return new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
  }

  function makeGlowMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  function makeSpriteTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);

    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(49,255,99,.95)");
    gradient.addColorStop(0.52, "rgba(247,201,72,.38)");
    gradient.addColorStop(1, "rgba(49,255,99,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function createScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");

    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    portalGroup = new THREE.Group();
    scene.add(portalGroup);

    const outerMat = makeGlowMaterial(0x31ff63, 0.92);
    const midMat = makeGlowMaterial(0xf7c948, 0.78);
    const innerMat = makeGlowMaterial(0x9bff9c, 0.88);
    const coreMat = makeGlowMaterial(0x31ff63, 0.72);

    ringOuter = new THREE.Mesh(makeRingGeometry(1.72, 0.035), outerMat);
    ringMid = new THREE.Mesh(makeRingGeometry(1.28, 0.026), midMat);
    ringInner = new THREE.Mesh(makeRingGeometry(0.86, 0.022), innerMat);

    ringOuter.rotation.x = Math.PI * 0.08;
    ringMid.rotation.x = -Math.PI * 0.09;
    ringInner.rotation.x = Math.PI * 0.06;

    portalGroup.add(ringOuter);
    portalGroup.add(ringMid);
    portalGroup.add(ringInner);

    const coreGeo = new THREE.SphereGeometry(0.26, 48, 48);
    core = new THREE.Mesh(coreGeo, coreMat);
    portalGroup.add(core);

    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.45 + Math.random() * 1.85;
      const z = (Math.random() - 0.5) * 0.8;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = z;

      const greenBias = Math.random();

      colors[i * 3] = greenBias > 0.35 ? 0.19 : 0.96;
      colors[i * 3 + 1] = greenBias > 0.35 ? 1.0 : 0.78;
      colors[i * 3 + 2] = greenBias > 0.35 ? 0.39 : 0.28;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.035,
      map: makeSpriteTexture(),
      transparent: true,
      opacity: 0.92,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    particles = new THREE.Points(particleGeo, particleMat);
    portalGroup.add(particles);

    const pos = getPortalPosition();
    portalGroup.position.set(pos.x, pos.y, 0);
    portalGroup.scale.setScalar(pos.scale);
  }

  function resize() {
    const rect = mount.getBoundingClientRect();
    width = Math.max(1, rect.width || window.innerWidth || 1);
    height = Math.max(1, rect.height || window.innerHeight || 1);

    if (!renderer || !camera) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);

    const pos = getPortalPosition();
    portalGroup.position.set(pos.x, pos.y, 0);
    portalGroup.scale.setScalar(pos.scale);
  }

  function animate(time = 0) {
    const t = time * 0.001;

    const pulse = 1 + Math.sin(t * 2.2) * 0.035;
    const corePulse = 1 + Math.sin(t * 4.2) * 0.18;

    portalGroup.rotation.x = pointer.y * 0.035;
    portalGroup.rotation.y = pointer.x * 0.045;

    ringOuter.rotation.z = t * 0.36;
    ringMid.rotation.z = -t * 0.52;
    ringInner.rotation.z = t * 0.78;

    ringOuter.scale.setScalar(pulse);
    ringMid.scale.setScalar(1 + Math.sin(t * 2.8) * 0.045);
    ringInner.scale.setScalar(1 + Math.cos(t * 3.1) * 0.055);

    core.scale.setScalar(corePulse);

    particles.rotation.z = -t * 0.24;
    particles.rotation.x = Math.sin(t * 0.6) * 0.12;

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  function bindMotion() {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );

    window.addEventListener("resize", resize, { passive: true });

    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(resize, 180);
      },
      { passive: true }
    );
  }

  function boot() {
    const rect = mount.getBoundingClientRect();

    width = Math.max(1, rect.width || window.innerWidth || 1);
    height = Math.max(1, rect.height || window.innerHeight || 1);

    createScene();
    bindMotion();
    resize();
    animate();
  }

  function destroy() {
    cancelAnimationFrame(animationId);

    if (renderer) {
      renderer.dispose();
    }

    if (mount) {
      mount.innerHTML = "";
    }
  }

  window.RichBiznessPortalThree = {
    destroy,
    resize
  };

  boot();
})();
