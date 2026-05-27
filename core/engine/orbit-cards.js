/* =========================
   RICH BIZNESS MOBILE
   /core/engine/orbit-cards.js

   STEP 3 LOCKED
   REAL PHONE ORBIT ENGINE
   Phones + Saturn Tilt + Tap Into Portal
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

  let orbitRoot;
  let ringRoot;
  let mounted = false;

  let orbitOffset = 0;
  let targetOffset = 0;

  let hoveredCard = null;
  let portalPush = null;
  let portalPushProgress = 0;

  let isDragging = false;
  let startX = 0;
  let lastX = 0;
  let dragMoved = false;

  const cards = [];

  const ORBIT_TILT_X = -0.48;
  const ORBIT_TILT_Z = 0.12;

  function mount() {
    if (mounted) return;

    ringRoot = new THREE.Group();
    ringRoot.rotation.x = ORBIT_TILT_X;
    ringRoot.rotation.z = ORBIT_TILT_Z;
    ringRoot.renderOrder = 22;

    orbitRoot = new THREE.Group();
    orbitRoot.rotation.x = ORBIT_TILT_X;
    orbitRoot.rotation.z = ORBIT_TILT_Z;
    orbitRoot.renderOrder = 32;

    scene.add(ringRoot);
    scene.add(orbitRoot);

    buildSaturnRings();
    buildCards();

    mounted = true;
  }

  function buildSaturnRings() {
    const ringData = [
      { r: 22.2, tube: 0.025, color: 0x00ff9d, opacity: 0.08 },
      { r: 24.6, tube: 0.022, color: 0xfacc15, opacity: 0.075 },
      { r: 27.2, tube: 0.018, color: 0x00ffcc, opacity: 0.055 },
      { r: 30.2, tube: 0.014, color: 0xfacc15, opacity: 0.04 }
    ];

    ringData.forEach((item, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(item.r, item.tube, 10, 260),
        new THREE.MeshBasicMaterial({
          color: item.color,
          transparent: true,
          opacity: item.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.userData.speed = 0.00045 + index * 0.00025;
      ring.userData.baseOpacity = item.opacity;
      ringRoot.add(ring);
    });
  }

  function buildCards() {
    modules.forEach((mod, index) => {
      const card = createPhoneCard(mod, index);

      card.userData.module = mod;
      card.userData.index = index;
      card.userData.isHot = false;
      card.userData.presenceBoost = 0;
      card.userData.pushing = false;
      card.userData.depth = 0;

      cards.push(card);
      orbitRoot.add(card);
    });
  }

  function createPhoneCard(mod, index) {
    const group = new THREE.Group();

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(5.25, 8.65, 0.82),
      new THREE.MeshPhongMaterial({
        color: 0x020403,
        specular: 0xfacc15,
        shininess: 150,
        transparent: true,
        opacity: 0.98
      })
    );

    const sideGlow = new THREE.Mesh(
      new THREE.BoxGeometry(5.55, 8.95, 0.9),
      new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    const screenTexture = textureLoader.load(
      mod.image,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
      },
      undefined,
      () => console.warn("[RB PHONE IMAGE MISSING]", mod.image)
    );

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.58, 7.58),
      new THREE.MeshBasicMaterial({
        map: screenTexture,
        transparent: true,
        opacity: 0.98,
        depthWrite: true
      })
    );
    screen.position.z = 0.48;

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.58, 7.58),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glass.position.z = 0.505;

    const shine = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 7.8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    shine.position.set(1.25, 0, 0.53);
    shine.rotation.z = -0.18;

    const speaker = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.13, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0x111827,
        transparent: true,
        opacity: 0.95
      })
    );
    speaker.position.set(0, 3.58, 0.56);

    const home = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    home.position.set(0, -3.65, 0.56);

    const aura = new THREE.Mesh(
      new THREE.PlaneGeometry(6.25, 9.6),
      new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    aura.position.z = 0.15;

    const iconLabel = createIconLabel(mod.icon || "📱", mod.tag);
    iconLabel.position.set(0, -5.18, 0.72);

    group.add(shell);
    group.add(sideGlow);
    group.add(screen);
    group.add(glass);
    group.add(shine);
    group.add(speaker);
    group.add(home);
    group.add(aura);
    group.add(iconLabel);

    group.scale.setScalar(0.72);
    group.renderOrder = 40 + index;

    return group;
  }

  function createIconLabel(icon, tag) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 256;

    const ctx2d = canvas.getContext("2d");

    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.shadowColor = "rgba(0,255,157,.95)";
    ctx2d.shadowBlur = 28;

    ctx2d.fillStyle = "rgba(2,4,3,.7)";
    roundRect(ctx2d, 74, 36, 620, 176, 48);
    ctx2d.fill();

    ctx2d.strokeStyle = "rgba(250,204,21,.52)";
    ctx2d.lineWidth = 4;
    roundRect(ctx2d, 74, 36, 620, 176, 48);
    ctx2d.stroke();

    ctx2d.shadowBlur = 22;
    ctx2d.font = "900 70px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText(icon, 260, 122);

    ctx2d.shadowColor = "rgba(250,204,21,.8)";
    ctx2d.shadowBlur = 16;
    ctx2d.fillStyle = "#fff7ed";
    ctx2d.font = "900 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx2d.fillText(tag, 438, 124);

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

    sprite.scale.set(4.9, 1.55, 1);
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

    updateRings(t);
    updateCards(t);
    updatePortalPush();
  }

  function updateRings(t) {
    ringRoot.children.forEach((ring, index) => {
      ring.rotation.z += ring.userData.speed * (index % 2 ? -1 : 1);

      ring.material.opacity =
        ring.userData.baseOpacity +
        Math.sin(t * 1.2 + index) * 0.018 +
        (activityState.liveActive ? 0.025 : 0);
    });
  }

  function updateCards(t) {
    const mobile = window.innerWidth <= motion.mobileBreakpoint;

    const radiusX = mobile ? 18.8 : 25.8;
    const radiusZ = mobile ? 6.8 : 9.4;

    const baseY = mobile ? -0.9 : -0.45;

    orbitOffset += (targetOffset - orbitOffset) * 0.065;

    cards.forEach((card, index) => {
      if (card.userData.pushing) return;

      const lane = index % 3;
      const laneOffset = (lane - 1) * 1.45;

      const angle =
        orbitOffset +
        (index / cards.length) * Math.PI * 2 +
        laneOffset * 0.015;

      const x = Math.cos(angle) * (radiusX + laneOffset);
      const z = Math.sin(angle) * (radiusZ + laneOffset * 0.35);

      const depth = (z + radiusZ) / (radiusZ * 2);
      const frontPower = THREE.MathUtils.clamp(depth, 0, 1);

      const saturnY =
        baseY +
        Math.sin(angle) * 2.15 +
        laneOffset * 0.18 +
        Math.sin(t * 1.4 + index) * 0.08;

      const scale =
        0.42 +
        frontPower * 0.5 +
        (card === hoveredCard ? 0.08 : 0) +
        (card.userData.isHot ? 0.06 : 0);

      card.position.set(x, saturnY, z + 1.15);

      card.rotation.y = -angle + Math.PI / 2;
      card.rotation.x = 0.18 + Math.sin(angle) * 0.32;
      card.rotation.z = -ORBIT_TILT_Z + Math.cos(angle) * 0.12;

      card.scale.setScalar(scale);

      card.userData.depth = frontPower;

      updatePhoneLook(card, frontPower, t);

      card.renderOrder = 30 + Math.round(frontPower * 160);
    });
  }

  function updatePhoneLook(card, depth, t) {
    const backFade = 0.38 + depth * 0.62;
    const hot = card.userData.isHot;

    card.children.forEach((child, index) => {
      if (!child.material) return;

      if (index === 0) child.material.opacity = 0.72 + depth * 0.26;
      if (index === 1) child.material.opacity = 0.04 + depth * 0.12;
      if (index === 2) child.material.opacity = backFade;
      if (index === 3) child.material.opacity = 0.025 + depth * 0.075;
      if (index === 4) child.material.opacity = 0.035 + depth * 0.09;
      if (index === 6) child.material.opacity = 0.18 + depth * 0.22;

      if (index === 7) {
        child.material.opacity = hot
          ? 0.12 + Math.sin(t * 5) * 0.045
          : depth * 0.035;
      }

      if (child.userData?.isLabel) {
        child.material.opacity = 0.12 + depth * 0.85;
        child.scale.set(
          4.6 + depth * 0.8,
          1.35 + depth * 0.22,
          1
        );
      }
    });
  }

  function startPortalPush(card) {
    if (!card?.userData?.module || portalPush) return;

    card.userData.pushing = true;

    portalPushProgress = 0;

    portalPush = {
      card,
      startPosition: card.position.clone(),
      startRotation: card.rotation.clone(),
      startScale: card.scale.x
    };

    if (labelEl) {
      labelEl.textContent = `ENTERING ${card.userData.module.title}`;
      labelEl.classList.add("is-visible");
    }

    window.dispatchEvent(
      new CustomEvent("rb:portal-card-push", {
        detail: card.userData.module
      })
    );
  }

  function updatePortalPush() {
    if (!portalPush) return;

    portalPushProgress += 0.034;

    const p = THREE.MathUtils.clamp(portalPushProgress, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);

    const card = portalPush.card;

    card.position.lerpVectors(
      portalPush.startPosition,
      new THREE.Vector3(0, -0.72, 1.2),
      ease
    );

    card.rotation.x = portalPush.startRotation.x + ease * 2.4;
    card.rotation.y = portalPush.startRotation.y + ease * 3.2;
    card.rotation.z = portalPush.startRotation.z + ease * 1.8;

    card.scale.setScalar(
      THREE.MathUtils.lerp(portalPush.startScale, 0.04, ease)
    );

    card.children.forEach((child) => {
      if (child.material?.opacity !== undefined) {
        child.material.opacity *= 0.982;
      }
    });

    if (p >= 1) {
      const mod = card.userData.module;

      window.dispatchEvent(
        new CustomEvent("rb:module-select", {
          detail: mod
        })
      );

      resetPortalPush();
    }
  }

  function resetPortalPush() {
    if (!portalPush) return;

    portalPush.card.userData.pushing = false;
    portalPush = null;
    portalPushProgress = 0;
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

    targetOffset += delta * 0.0085;
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
      card.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    });

    ringRoot?.traverse((obj) => {
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    });

    scene.remove(orbitRoot);
    scene.remove(ringRoot);

    cards.length = 0;
    orbitRoot = null;
    ringRoot = null;
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
