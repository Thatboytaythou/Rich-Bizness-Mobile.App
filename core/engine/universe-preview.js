/* =========================================
   7. core/engine/universe-preview.js
   THREE.JS CENTER UNIVERSE PREVIEW
========================================= */

const container = document.getElementById("portal-container");

if (container && window.THREE) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.z = 34;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const portal = new THREE.Mesh(
    new THREE.SphereGeometry(5.8, 72, 72),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 32,
      transparent: true,
      opacity: 0.82
    })
  );

  scene.add(portal);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(8.8, 72, 72),
    new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending
    })
  );

  scene.add(glow);

  const goldCore = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending
    })
  );

  scene.add(goldCore);

  const starsGeometry = new THREE.BufferGeometry();
  const stars = [];

  for (let i = 0; i < 4600; i++) {
    stars.push(THREE.MathUtils.randFloatSpread(280));
    stars.push(THREE.MathUtils.randFloatSpread(280));
    stars.push(THREE.MathUtils.randFloatSpread(280));
  }

  starsGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(stars, 3)
  );

  const starField = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.075,
      transparent: true,
      opacity: 0.7
    })
  );

  scene.add(starField);

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));

  const greenLight = new THREE.PointLight(0x22c55e, 2.4);
  greenLight.position.set(-22, 18, 34);
  scene.add(greenLight);

  const goldLight = new THREE.PointLight(0xfacc15, 2.8);
  goldLight.position.set(26, 22, 38);
  scene.add(goldLight);

  function resizeScene() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", resizeScene, { passive: true });
  window.addEventListener("orientationchange", resizeScene, { passive: true });

  function animate() {
    requestAnimationFrame(animate);

    portal.rotation.y += 0.0016;
    portal.rotation.x += 0.00035;

    glow.rotation.y -= 0.001;
    goldCore.rotation.y += 0.0025;

    starField.rotation.y += 0.00022;

    renderer.render(scene, camera);
  }

  animate();
}
