/* =========================
   RICH BIZNESS MOBILE
   /core/engine/avatar-engine.js

   CINEMATIC 3D AVATAR ENGINE
   Boy/Girl • Portal Roam • Controllable • Living Motion
   Safer cleanup + mobile scale lock + pointer control cleanup
   Profile Lock + XP Energy Sync Enabled
========================= */

export function createAvatarEngine(ctx) {
  const { THREE, scene, activityState = {} } = ctx;

  let avatarRoot = null;
  let avatar = null;
  let parts = {};
  let mounted = false;
  let controlsBound = false;
  let avatarType = "boy";
  let mode = "roam";

  const xpState = {
    xp: 0,
    level: 1,
    rank: "Biz Legend",
    percent: 0,
    energy: 0,
    pulse: 0
  };

  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false,
    run: false
  };

  const target = new THREE.Vector3(5.6, -2.55, 8.6);
  const velocity = new THREE.Vector3();
  const roamTarget = new THREE.Vector3(5.6, -2.55, 8.6);
  const zeroVector = new THREE.Vector3();
  const scaleVector = new THREE.Vector3();

  let movePadActive = false;
  let emotion = "boss";
  let portalDive = 0;
  let portalDiveTarget = 0;
  let walkTime = 0;
  let lastRoamPick = 0;

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function baseScale() {
    const base = window.innerWidth <= 720 ? 0.28 : 0.32;
    return base * (1 + xpState.energy * 0.035);
  }

  function syncXpState(source = activityState || {}) {
    const xp = Number(source.xp ?? source.rich_points ?? source.points ?? source.totalXp ?? xpState.xp ?? 0) || 0;
    const level = Number(source.level ?? source.rich_level ?? xpState.level ?? 1) || 1;
    const rank = source.rank || source.rankTitle || source.rank_title || xpState.rank || "Biz Legend";

    let percent = source.percent ?? source.xpPercent ?? source.progress ?? xpState.percent ?? 0;

    if (percent > 1) {
      percent = percent / 100;
    }

    percent = clamp01(percent);

    xpState.xp = xp;
    xpState.level = level;
    xpState.rank = rank;
    xpState.percent = percent;
    xpState.energy = clamp01(percent * 0.72 + Math.min(level, 100) / 240);
    xpState.pulse = Math.max(xpState.pulse, 1);

    if (avatarRoot && portalDive <= 0.01) {
      avatarRoot.scale.setScalar(baseScale());
    }
  }

  function mount() {
    if (mounted) return;

    syncXpState();

    avatarRoot = new THREE.Group();
    avatarRoot.position.copy(target);
    avatarRoot.scale.setScalar(baseScale());
    avatarRoot.renderOrder = 90;
    scene.add(avatarRoot);

    makeAvatar("boy");
    bindControls();

    mounted = true;
  }

  function makeMat(color, options = {}) {
    return new THREE.MeshPhongMaterial({
      color,
      shininess: options.shininess ?? 38,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1
    });
  }

  function makeBasic(color, options = {}) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite ?? true,
      wireframe: options.wireframe ?? false,
      blending: options.blending
    });
  }

  function part(name, geometry, material, position, scale = null) {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = name;
    mesh.position.set(position.x, position.y, position.z);

    if (scale) {
      mesh.scale.set(scale.x, scale.y, scale.z);
    }

    avatar.add(mesh);
    parts[name] = mesh;

    return mesh;
  }

  function disposeMaterial(material) {
    if (!material) return;

    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
      return;
    }

    material.dispose?.();
  }

  function disposeObject(obj) {
    obj?.traverse?.((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });

    obj?.geometry?.dispose?.();
    disposeMaterial(obj?.material);
  }

  function clearAvatar() {
    if (!avatar || !avatarRoot) return;

    avatarRoot.remove(avatar);
    disposeObject(avatar);

    avatar = null;
    parts = {};
  }

  function makeAvatar(type = "boy") {
    clearAvatar();

    avatarType = type;
    parts = {};

    avatar = new THREE.Group();
    avatar.userData.type = type;
    avatarRoot.add(avatar);

    const isGirl = type === "girl";
    const xpGlow = xpState.energy;
    const xpPulse = xpState.pulse;

    const skin = makeMat(isGirl ? 0xd89a78 : 0xe8b88a, { shininess: 32 });
    const outfit = makeMat(isGirl ? 0x15091c : 0x070a08, {
      emissive: isGirl ? 0x26051f : 0x021407,
      emissiveIntensity: 0.38 + xpGlow * 0.22,
      shininess: 46
    });

    const pants = makeMat(0x070d0b, { shininess: 20 });
    const shoes = makeMat(0x030303, { shininess: 68 });
    const hair = makeMat(0x050302, { shininess: 48 });
    const blue = makeMat(0x1e3a8a, { shininess: 62 });

    const gold = makeMat(0xfacc15, {
      emissive: 0xc99700,
      emissiveIntensity: 1.22 + xpGlow * 0.36,
      shininess: 150
    });

    const bodyW = isGirl ? 4.05 : 4.85;
    const bodyH = isGirl ? 7.05 : 7.45;
    const bodyD = isGirl ? 2.35 : 3;

    part("body", new THREE.BoxGeometry(bodyW, bodyH, bodyD), outfit, { x: 0, y: 0.45, z: 0 });

    part(
      "bodyGlow",
      new THREE.BoxGeometry(bodyW + 0.34, bodyH + 0.34, bodyD + 0.26),
      makeBasic(isGirl ? 0xf472b6 : 0x22c55e, {
        transparent: true,
        opacity: 0.08 + xpPulse * 0.015,
        wireframe: true,
        depthWrite: false
      }),
      { x: 0, y: 0.45, z: 0 }
    );

    part("neck", new THREE.CylinderGeometry(0.72, 0.84, 0.8, 28), skin, { x: 0, y: 4.25, z: 0 });
    part("head", new THREE.SphereGeometry(isGirl ? 1.9 : 2.05, 48, 48), skin, { x: 0, y: 5.45, z: 0 });

    if (isGirl) {
      part("hairBack", new THREE.BoxGeometry(3.15, 3.4, 0.85), hair, { x: 0, y: 5.35, z: -0.95 });
      part("hairTop", new THREE.SphereGeometry(2.05, 40, 16), hair, { x: 0, y: 6.3, z: 0 }, { x: 1, y: 0.45, z: 1 });
      part("hairLeft", new THREE.BoxGeometry(0.62, 3.1, 0.55), hair, { x: -1.72, y: 4.82, z: 0.2 });
      part("hairRight", new THREE.BoxGeometry(0.62, 3.1, 0.55), hair, { x: 1.72, y: 4.82, z: 0.2 });
    } else {
      part("beanie", new THREE.CylinderGeometry(2.05, 2.22, 1.45, 48), blue, { x: 0, y: 6.75, z: 0 });
      part("beanieTop", new THREE.SphereGeometry(2.05, 48, 16), blue, { x: 0, y: 7.43, z: 0 }, { x: 1, y: 0.38, z: 1 });
    }

    part(
      "shades",
      new THREE.BoxGeometry(isGirl ? 2.78 : 3.05, 0.45, 0.16),
      makeMat(0x010101, {
        emissive: isGirl ? 0x2b061e : 0x043018,
        emissiveIntensity: 0.62 + xpGlow * 0.2,
        shininess: 150
      }),
      { x: 0, y: 5.55, z: 1.72 }
    );

    part("mouth", new THREE.BoxGeometry(0.95, 0.12, 0.08), makeBasic(0x160706), {
      x: 0.12,
      y: 4.78,
      z: 1.88
    });

    const chain = part("chain", new THREE.TorusGeometry(isGirl ? 1.88 : 2.18, 0.22, 26, 72), gold, {
      x: 0,
      y: 3.85,
      z: 0
    });
    chain.rotation.x = Math.PI / 2;
    chain.scale.y = 0.74;

    const pendant = part("pendant", new THREE.CylinderGeometry(0.54, 0.54, 0.18, 40), gold, {
      x: 0,
      y: 3.12,
      z: 1.45
    });
    pendant.rotation.x = Math.PI / 2;

    part("leftLeg", new THREE.BoxGeometry(isGirl ? 1.25 : 1.55, 4.9, 1.55), pants, { x: -1.25, y: -3.4, z: 0 });
    part("rightLeg", new THREE.BoxGeometry(isGirl ? 1.25 : 1.55, 4.9, 1.55), pants, { x: 1.25, y: -3.4, z: 0 });

    part("leftShoe", new THREE.BoxGeometry(1.8, 0.6, 2.25), shoes, { x: -1.25, y: -6.1, z: 0.35 });
    part("rightShoe", new THREE.BoxGeometry(1.8, 0.6, 2.25), shoes, { x: 1.25, y: -6.1, z: 0.35 });

    part("leftArm", new THREE.BoxGeometry(1.18, 5.2, 1.25), outfit, { x: isGirl ? -2.62 : -3.05, y: 1.85, z: 0 });
    part("rightArm", new THREE.BoxGeometry(1.18, 5.2, 1.25), outfit, { x: isGirl ? 2.62 : 3.05, y: 1.85, z: 0 });

    part("leftHand", new THREE.SphereGeometry(0.55, 24, 24), skin, { x: isGirl ? -2.62 : -3.05, y: -1.1, z: 0.1 });
    part("rightHand", new THREE.SphereGeometry(0.55, 24, 24), skin, { x: isGirl ? 2.62 : 3.05, y: -1.1, z: 0.1 });

    part(
      "chatgptCore",
      new THREE.SphereGeometry(0.42, 32, 32),
      makeBasic(0x00ffcc, {
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      { x: 0, y: 1.55, z: 1.62 },
      { x: 1, y: 1, z: 0.28 }
    );

    avatar.scale.setScalar(isGirl ? 0.96 : 1);
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
    window.addEventListener("rb:app-xp-update", onXpGaugeUpdate);
    window.addEventListener("rb:universe-preview-update", onUniverseUpdate);

    window.RB_SWAP_AVATAR = swapAvatar;
    window.RB_AVATAR_MODE = setMode;
    window.RB_AVATAR_EMOTE = setEmotion;
    window.RB_AVATAR_PORTAL = portalJump;
  }

  function unbindControls() {
    if (!controlsBound) return;
    controlsBound = false;

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
    window.removeEventListener("rb:app-xp-update", onXpGaugeUpdate);
    window.removeEventListener("rb:universe-preview-update", onUniverseUpdate);

    if (window.RB_SWAP_AVATAR === swapAvatar) delete window.RB_SWAP_AVATAR;
    if (window.RB_AVATAR_MODE === setMode) delete window.RB_AVATAR_MODE;
    if (window.RB_AVATAR_EMOTE === setEmotion) delete window.RB_AVATAR_EMOTE;
    if (window.RB_AVATAR_PORTAL === portalJump) delete window.RB_AVATAR_PORTAL;
  }

  function onXpGaugeUpdate(event) {
    syncXpState(event?.detail || {});
  }

  function onUniverseUpdate(event) {
    syncXpState(event?.detail?.activityState || event?.detail || {});
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (key === "w" || event.key === "ArrowUp") keys.forward = true;
    if (key === "s" || event.key === "ArrowDown") keys.back = true;
    if (key === "a" || event.key === "ArrowLeft") keys.left = true;
    if (key === "d" || event.key === "ArrowRight") keys.right = true;
    if (event.key === "Shift") keys.run = true;

    if (key === "1") setEmotion("boss");
    if (key === "2") setEmotion("happy");
    if (key === "3") setEmotion("alert");
    if (key === "4") portalJump();
    if (key === "q") swapAvatar();

    mode = "control";
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();

    if (key === "w" || event.key === "ArrowUp") keys.forward = false;
    if (key === "s" || event.key === "ArrowDown") keys.back = false;
    if (key === "a" || event.key === "ArrowLeft") keys.left = false;
    if (key === "d" || event.key === "ArrowRight") keys.right = false;
    if (event.key === "Shift") keys.run = false;
  }

  function setMode(next = "roam") {
    mode = next;
  }

  function setEmotion(next = "boss") {
    emotion = next;
  }

  function swapAvatar() {
    if (!avatarRoot) return;
    makeAvatar(avatarType === "boy" ? "girl" : "boy");
  }

  function portalJump() {
    portalDiveTarget = 1;
    mode = "portal";
    xpState.pulse = Math.max(xpState.pulse, 1);
    window.dispatchEvent(new CustomEvent("rb:avatar-portal-jump"));
  }

  function onPointerDown(event) {
    const x = event.clientX / window.innerWidth;

    if (x < 0.34) {
      mode = "control";
      keys.left = true;
      movePadActive = true;
    }

    if (x > 0.66) {
      mode = "control";
      keys.right = true;
      movePadActive = true;
    }
  }

  function onPointerMove() {}

  function onPointerUp() {
    if (!movePadActive) return;

    keys.left = false;
    keys.right = false;
    keys.forward = false;
    keys.back = false;
    movePadActive = false;
  }

  function pickRoamTarget(t) {
    if (t - lastRoamPick < 4.2) return;

    lastRoamPick = t;
    roamTarget.set(
      THREE.MathUtils.randFloat(-8, 8),
      -2.55,
      THREE.MathUtils.randFloat(6.8, 10.5)
    );
  }

  function update(t) {
    if (!mounted || !avatarRoot || !avatar) return;

    walkTime += 0.016;
    xpState.pulse *= 0.94;

    updateMotion(t);
    updateBodyAnimation(t);
    updateEmotion(t);
    updatePortalDive();
  }

  function updateMotion(t) {
    const input = new THREE.Vector3();

    if (keys.forward) input.z -= 1;
    if (keys.back) input.z += 1;
    if (keys.left) input.x -= 1;
    if (keys.right) input.x += 1;

    const hasInput = input.lengthSq() > 0;
    const xpSpeed = 1 + xpState.energy * 0.22;

    if (hasInput) {
      input.normalize();
      const speed = (keys.run ? 0.16 : 0.085) * xpSpeed;
      velocity.lerp(input.multiplyScalar(speed), 0.18);
    } else if (mode === "roam") {
      pickRoamTarget(t);

      const toTarget = roamTarget.clone().sub(avatarRoot.position);
      toTarget.y = 0;

      if (toTarget.length() > 0.4) {
        toTarget.normalize().multiplyScalar(0.035 * xpSpeed);
        velocity.lerp(toTarget, 0.035);
      } else {
        velocity.lerp(zeroVector, 0.05);
      }
    } else {
      velocity.lerp(zeroVector, 0.1);
    }

    avatarRoot.position.x += velocity.x;
    avatarRoot.position.z += velocity.z;

    avatarRoot.position.x = THREE.MathUtils.clamp(avatarRoot.position.x, -11, 11);
    avatarRoot.position.z = THREE.MathUtils.clamp(avatarRoot.position.z, 5.8, 11.4);

    avatarRoot.position.y = -2.55 + Math.sin(t * 1.35) * (0.12 + xpState.energy * 0.035);

    if (velocity.lengthSq() > 0.00002) {
      const rot = Math.atan2(velocity.x, velocity.z);
      avatarRoot.rotation.y += (rot - avatarRoot.rotation.y) * 0.08;
    } else {
      avatarRoot.rotation.y += (Math.sin(t * 0.55) * (0.18 + xpState.energy * 0.04) - avatarRoot.rotation.y) * 0.035;
    }
  }

  function updateBodyAnimation(t) {
    const moving = velocity.lengthSq() > 0.00008;
    const runBoost = keys.run ? 1.75 : 1;
    const xpBoost = 1 + xpState.energy * 0.22;
    const step = Math.sin(t * 5.2 * runBoost * xpBoost) * (moving ? 1 : 0.18);
    const bounce = Math.abs(step) * (moving ? 0.09 : 0.025);

    avatar.position.y = bounce + xpState.pulse * 0.025;

    if (parts.head) {
      parts.head.position.y = 5.45 + Math.sin(t * 2.6) * (0.08 + xpState.energy * 0.018);
      parts.head.rotation.y = Math.sin(t * 1.05) * (0.055 + xpState.energy * 0.015);
    }

    if (parts.leftLeg) parts.leftLeg.rotation.x = step * 0.48;
    if (parts.rightLeg) parts.rightLeg.rotation.x = -step * 0.48;

    if (parts.leftArm) parts.leftArm.rotation.x = -step * 0.58;
    if (parts.rightArm) parts.rightArm.rotation.x = step * 0.58;

    if (parts.leftShoe && parts.leftLeg) {
      parts.leftShoe.rotation.x = parts.leftLeg.rotation.x * 0.22;
    }

    if (parts.rightShoe && parts.rightLeg) {
      parts.rightShoe.rotation.x = parts.rightLeg.rotation.x * 0.22;
    }

    if (parts.chain) parts.chain.rotation.z = Math.sin(t * 2.3) * (0.035 + xpState.energy * 0.012);
    if (parts.pendant) parts.pendant.rotation.z = Math.sin(t * 2.8) * (0.09 + xpState.energy * 0.018);

    if (parts.bodyGlow?.material) {
      parts.bodyGlow.material.opacity =
        0.055 +
        Math.abs(Math.sin(t * 1.8)) * 0.07 +
        (activityState.liveActive ? 0.03 : 0) +
        xpState.energy * 0.045 +
        xpState.pulse * 0.025;
    }

    if (parts.chatgptCore) {
      const corePulse = 1 + Math.sin(t * 4.4) * (0.18 + xpState.energy * 0.04) + xpState.pulse * 0.08;
      parts.chatgptCore.scale.set(corePulse, corePulse, 0.28);
      parts.chatgptCore.material.opacity = 0.68 + Math.sin(t * 3.8) * 0.16 + xpState.energy * 0.08;
    }

    if (parts.chain?.material) {
      parts.chain.material.emissiveIntensity = 1.2 + xpState.energy * 0.42 + xpState.pulse * 0.18;
    }

    if (parts.pendant?.material) {
      parts.pendant.material.emissiveIntensity = 1.2 + xpState.energy * 0.48 + xpState.pulse * 0.22;
    }
  }

  function updateEmotion(t) {
    if (!parts.mouth || !parts.shades || !parts.head) return;

    if (emotion === "happy") {
      parts.mouth.scale.x = 1.25 + Math.sin(t * 5) * 0.08;
      parts.mouth.position.y = 4.82;
      parts.head.rotation.z = Math.sin(t * 1.5) * 0.035;
    }

    if (emotion === "alert") {
      parts.shades.material.emissiveIntensity = 0.9 + Math.sin(t * 8) * 0.25 + xpState.energy * 0.18;
      parts.head.rotation.y = Math.sin(t * 2.6) * 0.11;
    }

    if (emotion === "boss") {
      parts.mouth.scale.x = 1;
      parts.mouth.position.y = 4.78;
      parts.head.rotation.z = 0;
      parts.shades.material.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.08 + xpState.energy * 0.14;
    }
  }

  function updatePortalDive() {
    portalDive += (portalDiveTarget - portalDive) * 0.045;

    if (portalDive > 0.01) {
      avatarRoot.position.x += (0 - avatarRoot.position.x) * 0.06;
      avatarRoot.position.z += (2.1 - avatarRoot.position.z) * 0.06;
      avatarRoot.position.y += (-1.65 - avatarRoot.position.y) * 0.04;

      avatarRoot.scale.setScalar(baseScale() * (1 - portalDive * 0.72));
      avatarRoot.rotation.y += 0.16 + xpState.energy * 0.04;

      if (portalDive > 0.92) {
        portalDiveTarget = 0;
        portalDive = 0;
        mode = "roam";
        xpState.pulse = Math.max(xpState.pulse, 1);

        avatarRoot.position.set(
          THREE.MathUtils.randFloat(-6, 6),
          -2.55,
          9.4
        );

        avatarRoot.scale.setScalar(baseScale());
      }
    } else {
      const next = baseScale();
      scaleVector.set(next, next, next);
      avatarRoot.scale.lerp(scaleVector, 0.08);
    }
  }

  function resize() {
    if (!avatarRoot || portalDive > 0.01) return;
    avatarRoot.scale.setScalar(baseScale());
  }

  function setActivityState(next = {}) {
    Object.assign(activityState, next);
    syncXpState(activityState);
  }

  function destroy() {
    unbindControls();

    keys.forward = false;
    keys.back = false;
    keys.left = false;
    keys.right = false;
    keys.run = false;

    movePadActive = false;
    xpState.pulse = 0;

    if (avatarRoot) {
      scene.remove(avatarRoot);
      disposeObject(avatarRoot);
    }

    mounted = false;
    avatarRoot = null;
    avatar = null;
    parts = {};
  }

  return {
    mount,
    update,
    resize,
    destroy,
    swapAvatar,
    setMode,
    setEmotion,
    portalJump,
    setActivityState,
    onPointerDown,
    onPointerMove,
    onPointerUp
  };
}
