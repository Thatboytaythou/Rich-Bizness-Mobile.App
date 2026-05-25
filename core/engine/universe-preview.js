// =============================================
// UNIVERSE PREVIEW - THREE.JS ENGINE
// =============================================

let scene, camera, renderer, portal, stars;

function initUniversePortal() {
  const container = document.createElement('div');
  container.id = 'portal-container';
  document.body.appendChild(container);

  // Scene Setup
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Central Portal Sphere
  portal = new THREE.Mesh(
    new THREE.SphereGeometry(15, 64, 64),
    new THREE.MeshPhongMaterial({ 
      color: 0x10b981, 
      emissive: 0x064e3b, 
      shininess: 20,
      transparent: true,
      opacity: 0.95
    })
  );
  scene.add(portal);

  // Galaxy Stars
  stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute(Array.from({length: 9000}, () => THREE.MathUtils.randFloatSpread(300)), 3)),
    new THREE.PointsMaterial({ 
      color: 0xfacc15, 
      size: 0.08,
      transparent: true,
      opacity: 0.85
    })
  );
  scene.add(stars);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const pointLight = new THREE.PointLight(0xfacc15, 3.5);
  pointLight.position.set(40, 35, 50);
  scene.add(pointLight);

  camera.position.z = 45;

  animatePortal();
}

function animatePortal() {
  requestAnimationFrame(animatePortal);
  
  if (portal) portal.rotation.y += 0.0007;   // Slow cinematic rotation
  if (stars) stars.rotation.y += 0.00025;

  renderer.render(scene, camera);
}

// Responsive resize
window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

initUniversePortal();
