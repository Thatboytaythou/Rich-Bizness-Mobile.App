/* =========================
   RICH BIZNESS MOBILE
   /core/engine/avatar-engine.js

   CINEMATIC 3D AVATAR ENGINE
   Boy/Girl • Portal Roam • Controllable • Living Motion
========================= */

export function createAvatarEngine(ctx) {
  const { THREE, scene, camera, activityState } = ctx;

  let avatarRoot;
  let avatar;
  let parts = {};
  let mounted = false;
  let avatarType = "boy";
  let mode = "roam";

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

  let movePadActive = false;
  let emotion = "boss";
  let portalDive = 0;
  let portalDiveTarget = 0;
  let walkTime = 0;
  let lastRoamPick = 0;

  function mount() {
    if (mounted) return;

    avatarRoot = new THREE.Group();
    avatarRoot.position.copy(target);
    avatarRoot.scale.setScalar(0.32);
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
    if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
    avatar.add(mesh);
    parts[name] = mesh;
    return mesh;
  }

  function makeAvatar(type = "boy") {
    if (avatar) avatarRoot.remove(avatar);

    avatarType = type;
    parts = {};
    avatar = new THREE.Group();
    avatar.userData.type = type;
    avatarRoot.add(avatar);

    const isGirl = type === "girl";

    const skin = makeMat(isGirl ? 0xd89a78 : 0xe8b88a, { shininess: 32 });
    const outfit = makeMat(isGirl ? 0x15091c : 0x070a08, {
      emissive: isGirl ? 0x26051f : 0x021407,
      emissiveIntensity: 0.38,
      shininess: 46
    });

    const pants = makeMat(0x070d0b, { shininess: 20 });
    const shoes = makeMat(0x030303, { shininess: 68 });
    const hair = makeMat(0x050302, { shininess: 48 });
    const blue = makeMat(0x1e3a8a, { shininess: 62 });

    const gold = makeMat(0xfacc15, {
      emissive: 0xc99700,
      emissiveIntensity: 1.22,
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
        opacity: 0.08,
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
        emissiveIntensity: 0.62,
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
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    window.RB_SWAP_AVATAR = swapAvatar;
    window.RB_AVATAR_MODE = setMode;
    window.RB_AVATAR_EMOTE = setEmotion;
    window.RB_AVATAR_PORTAL = portalJump;
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
    makeAvatar(avatarType === "boy" ? "girl" : "boy");
  }

  function portalJump() {
    portalDiveTarget = 1;
    mode = "portal";
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

    updateMotion(t);
    updateBodyAnimation(t);
    updateEmotion(t);
    updatePortalDive(t);
  }

  function updateMotion(t) {
    const input = new THREE.Vector3();

    if (keys.forward) input.z -= 1;
    if (keys.back) input.z += 1;
    if (keys.left) input.x -= 1;
    if (keys.right) input.x += 1;

    const hasInput = input.lengthSq() > 0;

    if (hasInput) {
      input.normalize();
      const speed = keys.run ? 0.16 : 0.085;
      velocity.lerp(input.multiplyScalar(speed), 0.18);
    } else if (mode === "roam") {
      pickRoamTarget(t);

      const toTarget = roamTarget.clone().sub(avatarRoot.position);
      toTarget.y = 0;

      if (toTarget.length() > 0.4) {
        toTarget.normalize().multiplyScalar(0.035);
        velocity.lerp(toTarget, 0.035);
      } else {
        velocity.lerp(new THREE.Vector3(0, 0, 0), 0.05);
      }
    } else {
      velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }

    avatarRoot.position.x += velocity.x;
    avatarRoot.position.z += velocity.z;

    avatarRoot.position.x = THREE.MathUtils.clamp(avatarRoot.position.x, -11, 11);
    avatarRoot.position.z = THREE.MathUtils.clamp(avatarRoot.position.z, 5.8, 11.4);

    avatarRoot.position.y = -2.55 + Math.sin(t * 1.35) * 0.12;

    if (velocity.lengthSq() > 0.00002) {
      const rot = Math.atan2(velocity.x, velocity.z);
      avatarRoot.rotation.y += (rot - avatarRoot.rotation.y) * 0.08;
    } else {
      avatarRoot.rotation.y += (Math.sin(t * 0.55) * 0.18 - avatarRoot.rotation.y) * 0.035;
    }
  }

  function updateBodyAnimation(t) {
    const moving = velocity.lengthSq() > 0.00008;
    const runBoost = keys.run ? 1.75 : 1;
    const step = Math.sin(t * 5.2 * runBoost) * (moving ? 1 : 0.18);
    const bounce = Math.abs(step) * (moving ? 0.09 : 0.025);

    avatar.position.y = bounce;

    if (parts.head) {
      parts.head.position.y = 5.45 + Math.sin(t * 2.6) * 0.08;
      parts.head.rotation.y = Math.sin(t * 1.05) * 0.055;
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

    if (parts.chain) parts.chain.rotation.z = Math.sin(t * 2.3) * 0.035;
    if (parts.pendant) parts.pendant.rotation.z = Math.sin(t * 2.8) * 0.09;

    if (parts.bodyGlow?.material) {
      parts.bodyGlow.material.opacity =
        0.055 + Math.abs(Math.sin(t * 1.8)) * 0.07 + (activityState.liveActive ? 0.03 : 0);
    }

    if (parts.chatgptCore) {
      parts.chatgptCore.scale.setScalar(1 + Math.sin(t * 4.4) * 0.18);
      parts.chatgptCore.material.opacity = 0.68 + Math.sin(t * 3.8) * 0.16;
    }
  }

  function updateEmotion(t) {
    if (!parts.mouth || !parts.shades) return;

    if (emotion === "happy") {
      parts.mouth.scale.x = 1.25 + Math.sin(t * 5) * 0.08;
      parts.mouth.position.y = 4.82;
      parts.head.rotation.z = Math.sin(t * 1.5) * 0.035;
    }

    if (emotion === "alert") {
      parts.shades.material.emissiveIntensity = 0.9 + Math.sin(t * 8) * 0.25;
      parts.head.rotation.y = Math.sin(t * 2.6) * 0.11;
    }

    if (emotion === "boss") {
      parts.mouth.scale.x = 1;
      parts.shades.material.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.08;
    }
  }

  function updatePortalDive(t) {
    portalDive += (portalDiveTarget - portalDive) * 0.045;

    if (portalDive > 0.01) {
      avatarRoot.position.x += (0 - avatarRoot.position.x) * 0.06;
      avatarRoot.position.z += (2.1 - avatarRoot.position.z) * 0.06;
      avatarRoot.position.y += (-1.65 - avatarRoot.position.y) * 0.04;

      avatarRoot.scale.setScalar(0.32 * (1 - portalDive * 0.72));
      avatarRoot.rotation.y += 0.16;

      if (portalDive > 0.92) {
        portalDiveTarget = 0;
        mode = "roam";
        avatarRoot.position.set(
          THREE.MathUtils.randFloat(-6, 6),
          -2.55,
          9.4
        );
        avatarRoot.scale.setScalar(0.32);
      }
    } else {
      avatarRoot.scale.lerp(new THREE.Vector3(0.32, 0.32, 0.32), 0.08);
    }
  }

  function resize() {
    if (!avatarRoot) return;

    const isMobile = window.innerWidth <= 720;
    avatarRoot.scale.setScalar(isMobile ? 0.28 : 0.32);
  }

  function destroy() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);

    if (avatarRoot) {
      scene.remove(avatarRoot);

      avatarRoot.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
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
    onPointerDown,
    onPointerMove,
    onPointerUp
  };
}
