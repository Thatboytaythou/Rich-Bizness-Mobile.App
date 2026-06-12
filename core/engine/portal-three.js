/* =========================
   RICH BIZNESS MOBILE
   /core/engine/portal-three.js

   Three.js Portal Layer
   - Smooth cinematic energy portal
   - Mounts inside #threePortal
   - Visual only
========================= */

(() => {
  const mount = document.getElementById("threePortal");

  if (!mount || !window.THREE) return;

  const THREE = window.THREE;

  let width = 1;
  let height = 1;
  let renderer;
  let scene;
  let camera;
  let portalGroup;
  let ringOuter;
  let ringGold;
  let ringInner;
  let glowDisc;
  let core;
  let particles;
  let animationId = 0;

  const pointer = {
    x: 0,
    y: 0
  };

  function isPortraitView() {
    return (
      window.innerWidth <= 900 ||
      window.matchMedia("(orientation: portrait)").matches
    );
  }

  function getPortalPosition() {
    const portrait = isPortraitView();

    return portrait
      ? { x: 0, y: 0.18, scale: 0.52 }
      : { x: 0, y: 0.05, scale: 0.68 };
  }

  function makeGlowMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
  }

  function makeRing(radius, tube, color, opacity) {
    const geometry = new THREE.TorusGeometry(radius, tube, 160, 320);
    const material = makeGlowMaterial(color, opacity);
    const mesh = new THREE.Mesh(geometry, material);

    portalGroup.add(mesh);
    return mesh;
  }

  function makeParticleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);

    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(49,255,99,.85)");
    gradient.addColorStop(0.58, "rgba(247,201,72,.28)");
    gradient.addColorStop(1, "rgba(49,255,99,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);

    return new THREE.CanvasTexture(canvas);
  }

  function createScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.setAttribute("aria-hidden", "true");

    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    portalGroup = new THREE.Group();
    scene.add(portalGroup);

    ringOuter = makeRing(1.78, 0.006, 0x31ff63, 0.34);
    ringGold = makeRing(1.18, 0.005, 0xf7c948, 0.22);
    ringInner = makeRing(0.58, 0.0045, 0x9bff9c, 0.24);

    ringOuter.rotation.x = 0.04;
    ringGold.rotation.x = -0.03;
    ringInner.rotation.x = 0.02;

    const glowGeometry = new THREE.CircleGeometry(1.45, 192);
    const glowMaterial = makeGlowMaterial(0x31ff63, 0.028);

    glowDisc = new THREE.Mesh(glowGeometry, glowMaterial);
    portalGroup.add(glowDisc);

    const coreGeometry = new THREE.CircleGeometry(0.11, 128);
    const coreMaterial = makeGlowMaterial(0x31ff63, 0.18);

    core = new THREE.Mesh(coreGeometry, coreMaterial);
    portalGroup.add(core);

    const particleCount = 320;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.35 + Math.random() * 1.85;
      const z = (Math.random() - 0.5) * 0.24;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = z;

      const gold = Math.random() > 0.82;

      colors[i * 3] = gold ? 0.97 : 0.19;
      colors[i * 3 + 1] = gold ? 0.79 : 1.0;
      colors[i * 3 + 2] = gold ? 0.28 : 0.39;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.014,
      map: makeParticleTexture(),
      transparent: true,
      opacity: 0.46,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    portalGroup.add(particles);

    applyLayout();
  }

  function applyLayout() {
    if (!portalGroup) return;

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

    applyLayout();
  }

  function animate(time = 0) {
    const t = time * 0.001;

    portalGroup.rotation.x = pointer.y * 0.018;
    portalGroup.rotation.y = pointer.x * 0.022;

    ringOuter.rotation.z = t * 0.22;
    ringGold.rotation.z = -t * 0.34;
    ringInner.rotation.z = t * 0.48;

    ringOuter.scale.setScalar(1 + Math.sin(t * 1.6) * 0.014);
    ringGold.scale.setScalar(1 + Math.sin(t * 2.1 + 1.2) * 0.016);
    ringInner.scale.setScalar(1 + Math.cos(t * 2.6) * 0.018);

    glowDisc.scale.setScalar(1 + Math.sin(t * 1.3) * 0.035);
    glowDisc.material.opacity = 0.022 + Math.sin(t * 1.5) * 0.008;

    core.scale.setScalar(1 + Math.sin(t * 4.2) * 0.1);
    core.material.opacity = 0.14 + Math.sin(t * 3.8) * 0.04;

    particles.rotation.z = -t * 0.12;
    particles.rotation.x = Math.sin(t * 0.5) * 0.035;

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  function bindEvents() {
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
    bindEvents();
    resize();
    animate();
  }

  function destroy() {
    cancelAnimationFrame(animationId);

    if (renderer) {
      renderer.dispose();
    }

    mount.innerHTML = "";
  }

  window.RichBiznessPortalThree = {
    resize,
    destroy
  };

  boot();
})();
