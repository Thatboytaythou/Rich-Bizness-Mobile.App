let scene, camera, renderer, portal, stars;

function initUniversePortal() {
  const container = document.createElement('div');
  container.id = 'portal-container';
  document.body.appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  portal = new THREE.Mesh(
    new THREE.SphereGeometry(15, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x064e3b, shininess: 20 })
  );
  scene.add(portal);

  stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute(Array.from({length: 9000}, () => THREE.MathUtils.randFloatSpread(300)), 3)),
    new THREE.PointsMaterial({ color: 0xfacc15, size: 0.08 })
  );
  scene.add(stars);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.PointLight(0xfacc15, 3.5);
  light.position.set(40, 35, 50);
  scene.add(light);

  camera.position.z = 45;

  animatePortal();
}

function animatePortal() {
  requestAnimationFrame(animatePortal);
  if (portal) portal.rotation.y += 0.0008;
  if (stars) stars.rotation.y += 0.0002;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

initUniversePortal();
