/* =========================
   RICH BIZNESS MOBILE
   core/engine/universe-preview.js
========================= */

import RB_CONFIG from "/core/shared/rb-config.js";

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

if (container && window.THREE) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 2, 45);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const portal = new THREE.Mesh(
    new THREE.SphereGeometry(8, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 30
    })
  );

  scene.add(portal);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(10.5, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending
    })
  );

  scene.add(glow);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const light = new THREE.PointLight(0xfacc15, 3);
  light.position.set(20, 30, 40);
  scene.add(light);

  const phones = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let hoveredPhone = null;

  const modules = RB_CONFIG.modules || [
    "Feed",
    "Live",
    "Gaming",
    "Sports",
    "Music",
    "Podcast",
    "Radio",
    "Gallery",
    "Store",
    "Meta"
  ];

  function makeSlug(label) {
    return String(label).toLowerCase().replace(/\s+/g, "-");
  }

  function createPhone(label) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3, 6, 0.4),
      new THREE.MeshPhongMaterial({
        color: 0x111827,
        shininess: 18
      })
    );

    group.add(body);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.2),
      new THREE.MeshPhongMaterial({
        color: 0x1f2937,
        emissive: 0x10b981,
        emissiveIntensity: 0.2
      })
    );

    screen.position.z = 0.21;
    group.add(screen);

    const iconGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending
      })
    );

    iconGlow.position.z = 0.23;
    iconGlow.position.y = 0.7;
    group.add(iconGlow);

    group.userData = {
      label,
      slug: makeSlug(label)
    };

    scene.add(group);
    phones.push(group);

    return group;
  }

  modules.forEach((label, index) => {
    const phone = createPhone(label);
    const angle = (index / modules.length) * Math.PI * 2;
    const radius = 22;

    phone.position.x = Math.cos(angle) * radius;
    phone.position.z = Math.sin(angle) * radius - 5;
    phone.rotation.y = angle + Math.PI / 2;
  });

  function setLabel(text) {
    if (!labelEl) return;

    labelEl.textContent = text || "";
    labelEl.classList.toggle("active", Boolean(text));
  }

  function setHovered(phone) {
    if (hoveredPhone && hoveredPhone !== phone) {
      hoveredPhone.scale.set(1, 1, 1);
    }

    hoveredPhone = phone;

    if (hoveredPhone) {
      hoveredPhone.scale.set(1.22, 1.22, 1.22);
      setLabel(hoveredPhone.userData.label);
      document.body.dataset.activeSection = hoveredPhone.userData.slug;
    } else {
      setLabel("");
      document.body.dataset.activeSection = "";
    }
  }

  function updatePointer(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(phones, true);

    if (!intersects.length) {
      setHovered(null);
      return;
    }

    let obj = intersects[0].object;

    while (obj && !phones.includes(obj)) {
      obj = obj.parent;
    }

    if (obj) {
      setHovered(obj);
    }
  }

  window.addEventListener(
    "mousemove",
    (event) => updatePointer(event.clientX, event.clientY),
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      updatePointer(touch.clientX, touch.clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "click",
    () => {
      if (!hoveredPhone) return;

      const route = RB_CONFIG.routes?.[hoveredPhone.userData.slug];

      if (route) {
        window.location.href = route;
      }
    },
    { passive: true }
  );

  function resizeScene() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  window.addEventListener("resize", resizeScene, { passive: true });
  window.addEventListener("orientationchange", resizeScene, { passive: true });

  function animate() {
    requestAnimationFrame(animate);

    portal.rotation.y += 0.0012;
    portal.rotation.x += 0.0003;

    glow.rotation.y -= 0.0008;

    phones.forEach((phone, index) => {
      const time = Date.now() * 0.0004 + index;
      const radius = window.innerWidth < 680 ? 16 : 22;

      phone.position.x = Math.cos(time) * radius;
      phone.position.z = Math.sin(time) * radius - 5;
      phone.rotation.y = time + Math.PI / 2;
    });

    renderer.render(scene, camera);
  }

  animate();
}
