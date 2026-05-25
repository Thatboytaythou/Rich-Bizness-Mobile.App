import RB_CONFIG from "/core/shared/rb-config.js";

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 4, 42);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const light = new THREE.PointLight(0xfacc15, 3);
light.position.set(20, 30, 40);
scene.add(light);

const portal = new THREE.Mesh(
  new THREE.SphereGeometry(5.6, 64, 64),
  new THREE.MeshPhongMaterial({
    color: 0x10b981,
    emissive: 0x064e3b,
    shininess: 40
  })
);
scene.add(portal);

const glow = new THREE.Mesh(
  new THREE.SphereGeometry(7.4, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending
  })
);
scene.add(glow);

const modules = [
  "Feed",
  "Live",
  "Music",
  "Podcast",
  "Radio",
  "Gaming",
  "Upload",
  "Sports",
  "Gallery",
  "Store",
  "Meta"
];

const phones = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let activePhone = null;

function slug(text) {
  return text.toLowerCase();
}

function makeTextTexture(title) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#071007";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(256, 210, 20, 256, 240, 360);
  gradient.addColorStop(0, "rgba(52,211,153,.5)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#34d399";
  ctx.font = "bold 42px system-ui";
  ctx.letterSpacing = "8px";
  ctx.fillText(title.toUpperCase(), 54, 120);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 68px system-ui";
  ctx.fillText(title, 54, 420);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "700 28px system-ui";
  ctx.fillText("Rich Bizness", 54, 480);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createPhone(title) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 7.6, 0.45),
    new THREE.MeshPhongMaterial({
      color: 0x030703,
      shininess: 28
    })
  );

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.05, 7.15),
    new THREE.MeshBasicMaterial({
      map: makeTextTexture(title),
      transparent: true,
      opacity: 0.92
    })
  );

  screen.position.z = 0.26;

  group.add(body);
  group.add(screen);

  group.userData = {
    label: title,
    section: slug(title)
  };

  scene.add(group);
  phones.push(group);
}

modules.forEach(createPhone);

function updateCards() {
  const now = Date.now() * 0.00033;
  const radiusX = innerWidth < 700 ? 12 : 18;
  const radiusZ = innerWidth < 700 ? 8 : 11;

  phones.forEach((phone, index) => {
    const angle = now + index * ((Math.PI * 2) / phones.length);

    phone.position.x = Math.cos(angle) * radiusX;
    phone.position.y = Math.sin(angle) * 2.1;
    phone.position.z = Math.sin(angle) * radiusZ + 6;

    const depth = (phone.position.z + radiusZ) / (radiusZ * 2);
    const scale = 0.72 + depth * 0.55;

    phone.scale.set(scale, scale, scale);
    phone.rotation.y = angle + Math.PI / 2;

    phone.visible = true;
  });
}

function setActive(phone) {
  activePhone = phone;

  if (!labelEl) return;

  if (!phone) {
    labelEl.classList.remove("active");
    labelEl.textContent = "";
    return;
  }

  labelEl.textContent = phone.userData.label;
  labelEl.classList.add("active");
  document.body.dataset.activeSection = phone.userData.section;
}

window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(phones, true);

  if (!hits.length) {
    setActive(null);
    return;
  }

  let obj = hits[0].object;
  while (obj && !phones.includes(obj)) obj = obj.parent;

  if (obj) setActive(obj);
});

window.addEventListener("click", () => {
  if (!activePhone) return;

  const route = RB_CONFIG.routes[activePhone.userData.section];
  if (route) window.location.href = route;
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

function animate() {
  requestAnimationFrame(animate);

  portal.rotation.y += 0.0018;
  portal.rotation.x += 0.0005;
  glow.rotation.y -= 0.001;

  updateCards();

  renderer.render(scene, camera);
}

animate();
