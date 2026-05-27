/* =========================
   RICH BIZNESS MOBILE
   /core/engine/orbit-cards.js

   ADVANCED ORBIT PHONE CARDS ENGINE
   Real Phone Bodies + Planet Orbit + Tap Into Portal
========================= */

export function createOrbitCardsEngine(ctx) {
  const {
    THREE,
    scene,
    camera,
    renderer,
    textureLoader,
    raycaster,
    pointer,
    motion,
    modules,
    activityState,
    labelEl
  } = ctx;

  let orbitGroup;
  let phoneHaloGroup;
  let mounted = false;

  let hoveredCard = null;
  let selectedCard = null;

  let orbitOffset = 0;
  let targetOffset = 0;

  let isDragging = false;
  let startX = 0;
  let lastX = 0;
  let dragMoved = false;

  let portalPush = null;
  let portalPushProgress = 0;

  const cards = [];
  const cardGlowPool = [];

  function mount() {
    if (mounted) return;

    orbitGroup = new THREE.Group();
    orbitGroup.renderOrder = 30;

    phoneHaloGroup = new THREE.Group();
    phoneHaloGroup.renderOrder = 28;

    scene.add(phoneHaloGroup);
    scene.add(orbitGroup);

    buildOrbitHalo();
    buildCards();

    mounted = true;
  }

  function buildOrbitHalo() {
    for (let i = 0; i < 4; i += 1) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(23 + i * 1.9, 0.025, 10, 260),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xfacc15 : 0x00ff9d,
          transparent: true,
          opacity: 0.035,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      halo.rotation.x = Math.PI / (2.45 + i * 0.18);
      halo.rotation.y = i * 0.18;
      halo.rotation.z = i * 0.44;

      halo.userData.speed = 0.0007 + i * 0.00035;
      phoneHaloGroup.add(halo);
    }
  }

  function buildCards() {
    modules.forEach((mod, index) => {
      const card = createPhoneCard(mod, index);

      card.userData.module = mod;
      card.userData.index = index;
      card.userData.isHot = false;
      card.userData.presenceBoost = 0;
      card.userData.depth = 0;
      card.userData.baseScale = 1;
      card.userData.portalLock = false;
      card.userData.pushing = false;
      card.userData.pushProgress = 0;

      cards.push(card);
      orbitGroup.add(card);
    });
  }

  function createPhoneCard(mod, index) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(5.55, 8.95, 0.72),
      new THREE.MeshPhongMaterial({
        color: 0x030604,
        specular: 0xfacc15,
        shininess: 140,
        transparent: true,
        opacity: 0.97
      })
    );

    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(5.78, 9.18, 0.16),
      new THREE.MeshPhongMaterial({
        color: 0x07110c,
        specular: 0x00ff9d,
        shininess: 90,
        transparent: true,
        opacity: 0.72
      })
    );
    backPlate.position.z = -0.38;

    const screenTexture = textureLoader.load(
      mod.image,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
      },
      undefined,
      () => console.warn("[RB ORBIT CARD IMAGE MISSING]", mod.image)
    );

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.82, 7.92),
      new THREE.MeshBasicMaterial({
        map: screenTexture,
        transparent: true,
        opacity: 0.99,
        depthWrite: true
      })
    );
    screen.position.z = 0.42;

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.82, 7.92),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glass.position.z = 0.455;

    const shine = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 8.22),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    shine.position.set(1.28, 0, 0.48);
    shine.rotation.z = -0.16;

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(5.78, 9.18, 0.08),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.24,
        wireframe: true,
        depthWrite: false
      })
    );
    rim.position.z = 0.51;

    const emeraldRim = new THREE.Mesh(
      new THREE.BoxGeometry(5.95, 9.35, 0.08),
      new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
        depthWrite: false
      })
    );
    emeraldRim.position.z = 0.535;

    const speaker = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.12, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x111827,
        transparent: true,
        opacity: 0.9
      })
    );
    speaker.position.set(0, 3.72, 0.57);

    const homeGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.025, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    homeGlow.position.set(0, -3.86, 0.57);

    const hotAura = new THREE.Mesh(
      new THREE.PlaneGeometry(6.75, 10.22),
      new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    hotAura.position.z = 0.2;

    const label = createTextLabel(mod.tag, mod.title);
    label.position.set(0, -5.42, 0.68);

    group.add(body);
    group.add(backPlate);
    group.add(screen);
    group.add(glass);
    group.add(shine);
    group.add(rim);
    group.add(emeraldRim);
    group.add(speaker);
    group.add(homeGlow);
    group.add(hotAura);
    group.add(label);

    group.scale.setScalar(0.72);
    group.renderOrder = 40 + index;

    return group;
  }

  function createTextLabel(tag, title) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;

    const ctx2d = canvas.getContext("2d");

    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.shadowColor = "rgba(16,185,129,.95)";
    ctx2d.shadowBlur = 28;

    ctx2d.fillStyle = "rgba(5,8,5,.62)";
    roundRect(ctx2d, 64, 28, 896, 190, 46);
    ctx2d.fill();

    ctx2d.strokeStyle = "rgba(251,191,36,.5)";
    ctx2d.lineWidth = 4;
    roundRect(ctx2d, 64, 28, 896, 190, 46);
    ctx2d.stroke();

    ctx2d.shadowBlur = 18;
    ctx2d.fillStyle = "#34d399";
    ctx2d.font = "900 52px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText(tag, 512, 82);

    ctx2d.shadowColor = "rgba(251,191,36,.82)";
    ctx2d.shadowBlur = 14;
    ctx2d.fillStyle = "#fff7ed";
    ctx2d.font = "900 64px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx2d.fillText(title, 512, 152);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      })
    );

    sprite.scale.set(6.35, 1.58, 1);
    sprite.renderOrder = 80;
    sprite.userData.isLabel = true;

    return sprite;
  }

  function roundRect(ctx2d, x, y, w, h, r) {
    ctx2d.beginPath();
    ctx2d.moveTo(x + r, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, r);
    ctx2d.arcTo(x + w, y + h, x, y + h, r);
    ctx2d.arcTo(x, y + h, x, y, r);
    ctx2d.arcTo(x, y, x + w, y, r);
    ctx2d.closePath();
  }

  function update(t) {
    if (!mounted) return;

    targetOffset += (motion.orbit.speed || 0.00245) * activityState.orbitBoost;

    updateOrbitHalo(t);
    updateCards(t);
    updatePortalPush(t);
  }

  function updateOrbitHalo(t) {
    if (!phoneHaloGroup) return;

    phoneHaloGroup.children.forEach((halo, index) => {
      halo.rotation.z += halo.userData.speed * (index % 2 ? -1 : 1);
      halo.rotation.y += 0.00055 * (index + 1);

      halo.material.opacity =
        0.022 +
        Math.sin(t * 1.2 + index) * 0.012 +
        (activityState.liveActive ? 0.018 : 0);
    });
  }

  function updateCards(t) {
    const isMobile = window.innerWidth <= motion.mobileBreakpoint;

    const radiusX = isMobile
      ? motion.orbit.mobileRadiusX / 10
      : motion.orbit.desktopRadiusX / 10;

    const radiusZ = isMobile
      ? motion.orbit.mobileRadiusY / 10
      : motion.orbit.desktopRadiusY / 10;

    const baseY = isMobile ? -1.02 : -0.52;

    orbitOffset += (targetOffset - orbitOffset) * 0.062;

    cards.forEach((card, index) => {
      if (card.userData.pushing) return;

      const angle = orbitOffset + (index / cards.length) * Math.PI * 2;

      const x = Math.cos(angle) * radiusX;
      const z = Math.sin(angle) * radiusZ;

      const depth = (z + radiusZ) / (radiusZ * 2);
      const centerPull = Math.max(0, 1 - Math.abs(x) / radiusX);

      const scale = 0.4 + depth * 0.48 + centerPull * 0.1;
      const opacity = 0.46 + depth * 0.54;

      const hotBoost = card.userData.isHot ? 1.14 : 1;
      const presenceBoost = card.userData.presenceBoost ? 1.045 : 1;
      const hoverBoost = card === hoveredCard ? 1.14 : 1;

      const floatY =
        Math.sin(t * 1.4 + index * 0.8) *
        (0.045 + depth * 0.035);

      card.position.set(
        x,
        baseY + depth * 1.16 + floatY,
        z + 1.38
      );

      card.rotation.y = -angle + Math.PI / 2;
      card.rotation.x = Math.sin(t * 0.6 + index) * 0.018;
      card.rotation.z = Math.sin(angle) * 0.04;

      card.scale.setScalar(
        scale * hotBoost * presenceBoost * hoverBoost
      );

      card.userData.depth = depth;

      updatePhoneMaterials(card, depth, opacity, centerPull, t);
      card.renderOrder = 40 + Math.round(depth * 140);
    });
  }

  function updatePhoneMaterials(card, depth, opacity, centerPull, t) {
    card.children.forEach((child, childIndex) => {
      if (!child.material) return;

      if (childIndex === 0) child.material.opacity = 0.82 + opacity * 0.14;
      if (childIndex === 1) child.material.opacity = 0.45 + opacity * 0.24;
      if (childIndex === 2) child.material.opacity = opacity;
      if (childIndex === 3) child.material.opacity = 0.025 + depth * 0.055;
      if (childIndex === 4) child.material.opacity = 0.04 + depth * 0.08;
      if (childIndex === 5) child.material.opacity = 0.1 + depth * 0.16;
      if (childIndex === 6) child.material.opacity = 0.06 + depth * 0.11;
      if (childIndex === 8) child.material.opacity = 0.16 + depth * 0.18;

      if (childIndex === 9) {
        child.material.opacity = card.userData.isHot
          ? 0.1 + Math.sin(t * 4.8) * 0.045
          : centerPull * 0.035;
      }

      if (child.userData?.isLabel) {
        child.material.opacity = 0.08 + depth * 0.9;
        child.scale.set(
          5.28 + depth * 1.42,
          1.26 + depth * 0.42,
          1
        );
      }
    });
  }

  function updatePortalPush(t) {
    if (!portalPush) return;

    portalPushProgress += 0.035;

    const p = THREE.MathUtils.clamp(portalPushProgress, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);

    const card = portalPush.card;

    card.userData.pushing = true;

    card.position.lerpVectors(
      portalPush.startPosition,
      new THREE.Vector3(0, -0.75, 1.8),
      ease
    );

    card.rotation.x += 0.035;
    card.rotation.y += 0.055;
    card.rotation.z += 0.025;

    const shrink = THREE.MathUtils.lerp(portalPush.startScale, 0.05, ease);
    card.scale.setScalar(shrink);

    card.children.forEach((child) => {
      if (child.material?.opacity !== undefined) {
        child.material.opacity *= 0.985;
      }
    });

    if (p >= 1) {
      const module = card.userData.module;

      window.dispatchEvent(
        new CustomEvent("rb:module-select", {
          detail: module
        })
      );

      resetPortalPush();
    }
  }

  function startPortalPush(card) {
    if (!card?.userData?.module) return;

    selectedCard = card;
    portalPushProgress = 0;

    portalPush = {
      card,
      startPosition: card.position.clone(),
      startScale: card.scale.x
    };

    if (labelEl) {
      labelEl.textContent = `Entering ${card.userData.module.title}`;
      labelEl.classList.add("is-visible");
    }

    window.dispatchEvent(
      new CustomEvent("rb:portal-card-push", {
        detail: card.userData.module
      })
    );
  }

  function resetPortalPush() {
    if (!portalPush) return;

    const card = portalPush.card;
    card.userData.pushing = false;

    card.children.forEach((child) => {
      if (child.material?.opacity !== undefined) {
        child.material.opacity = 1;
      }
    });

    portalPush = null;
    portalPushProgress = 0;
    selectedCard = null;
  }

  function onPointerDown(event) {
    isDragging = true;
    startX = event.clientX;
    lastX = event.clientX;
    dragMoved = false;

    updatePointer(event);
  }

  function onPointerMove(event) {
    updatePointer(event);

    if (!isDragging) {
      checkHover();
      return;
    }

    const delta = event.clientX - lastX;

    if (Math.abs(event.clientX - startX) > 6) {
      dragMoved = true;
    }

    targetOffset += delta * 0.008;
    lastX = event.clientX;
  }

  function onPointerUp(event) {
    updatePointer(event);

    isDragging = false;

    const hit = getHitCard();

    if (!dragMoved && hit) {
      startPortalPush(hit);
      return;
    }

    checkHover();
  }

  function updatePointer(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function getHitCard() {
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(cards, true);

    if (!hits.length) return null;

    let obj = hits[0].object;

    while (obj && !obj.userData.module) {
      obj = obj.parent;
    }

    return obj || null;
  }

  function checkHover() {
    const hit = getHitCard();

    hoveredCard = hit;

    if (!labelEl) return;

    if (hit?.userData?.module) {
      labelEl.textContent = hit.userData.module.title;
      labelEl.classList.add("is-visible");
    } else {
      labelEl.classList.remove("is-visible");
    }
  }

  function onActivityUpdate(state) {
    cards.forEach((card) => {
      if (card.userData.module?.key === "live") {
        card.userData.isHot = Boolean(state.liveActive);
        card.userData.activityCount = state.liveCount || 0;
      }
    });
  }

  function onPresenceUpdate(state) {
    cards.forEach((card) => {
      card.userData.presenceBoost = state.onlineCount > 0 ? 1 : 0;
    });
  }

  function resize() {}

  function destroy() {
    cards.forEach((card) => {
      orbitGroup?.remove(card);

      card.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    });

    phoneHaloGroup?.traverse((obj) => {
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    });

    scene.remove(orbitGroup);
    scene.remove(phoneHaloGroup);

    cards.length = 0;
    cardGlowPool.length = 0;

    orbitGroup = null;
    phoneHaloGroup = null;
    mounted = false;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onActivityUpdate,
    onPresenceUpdate
  };
}
