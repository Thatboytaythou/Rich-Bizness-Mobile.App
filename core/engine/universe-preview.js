/* =========================================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js
========================================= */

const RBUniversePreview = (() => {
  const container = document.getElementById("portal-container");

  if (!container || !window.THREE) return null;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera.position.z = 38;

  const portal = new THREE.Mesh(
    new THREE.SphereGeometry(13, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 22,
      transparent: true,
      opacity: 0.9
    })
  );

  scene.add(portal);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(7.4, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending
    })
  );

  scene.add(core);

  const starsGeo = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < 6400; i += 1) {
    positions.push(THREE.MathUtils.randFloatSpread(320));
    positions.push(THREE.MathUtils.randFloatSpread(320));
    positions.push(THREE.MathUtils.randFloatSpread(320));
  }

  starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const stars = new THREE.Points(
    starsGeo,
    new THREE.PointsMaterial({
      color: 0xfacc15,
      size: 0.09,
      transparent: true,
      opacity: 0.78
    })
  );

  scene.add(stars);

  const smokeGeo = new THREE.BufferGeometry();
  const smokePositions = [];

  for (let i = 0; i < 1200; i += 1) {
    smokePositions.push(THREE.MathUtils.randFloatSpread(190));
    smokePositions.push(THREE.MathUtils.randFloatSpread(120));
    smokePositions.push(THREE.MathUtils.randFloatSpread(120));
  }

  smokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(smokePositions, 3));

  const smoke = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({
      color: 0x22c55e,
      size: 0.32,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending
    })
  );

  scene.add(smoke);

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));

  const goldLight = new THREE.PointLight(0xfacc15, 3.2);
  goldLight.position.set(36, 28, 42);
  scene.add(goldLight);

  const greenLight = new THREE.PointLight(0x22c55e, 2.6);
  greenLight.position.set(-38, -18, 34);
  scene.add(greenLight);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", resize, { passive: true });

  function animate() {
    requestAnimationFrame(animate);

    portal.rotation.y += 0.0014;
    portal.rotation.x += 0.00022;

    core.rotation.y -= 0.0018;

    stars.rotation.y += 0.00034;
    stars.rotation.x += 0.00008;

    smoke.rotation.y -= 0.00028;
    smoke.rotation.x += 0.00006;

    renderer.render(scene, camera);
  }

  animate();

  return {
    scene,
    camera,
    renderer,
    resize
  };
})();

window.RBUniversePreview = RBUniversePreview;
