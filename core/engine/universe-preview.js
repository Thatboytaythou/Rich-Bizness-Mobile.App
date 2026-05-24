export function startUniversePreview(containerId = "portal-container") {
  const container = document.getElementById(containerId);

  if (!container || !window.THREE) {
    return;
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const portal = new THREE.Mesh(
    new THREE.SphereGeometry(13, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 20,
      transparent: true,
      opacity: 0.92
    })
  );

  scene.add(portal);

  const starsGeo = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < 5200; i += 1) {
    positions.push(THREE.MathUtils.randFloatSpread(300));
    positions.push(THREE.MathUtils.randFloatSpread(300));
    positions.push(THREE.MathUtils.randFloatSpread(300));
  }

  starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const stars = new THREE.Points(
    starsGeo,
    new THREE.PointsMaterial({
      color: 0xfacc15,
      size: 0.095,
      transparent: true,
      opacity: 0.8
    })
  );

  scene.add(stars);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const light = new THREE.PointLight(0xfacc15, 3);
  light.position.set(40, 30, 50);
  scene.add(light);

  camera.position.z = 38;

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
    portal.rotation.y += 0.0015;
    portal.rotation.x += 0.00025;
    stars.rotation.y += 0.0004;
    renderer.render(scene, camera);
  }

  animate();
}
