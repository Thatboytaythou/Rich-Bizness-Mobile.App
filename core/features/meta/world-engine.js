/* =========================
   RICH BIZNESS MOBILE
   /core/features/meta/world-engine.js

   META WORLD ENGINE
   Preview mode for Index + full mode for Meta
========================= */

export function createMetaWorldEngine(ctx, options = {}) {
  const {
    THREE,
    scene,
    camera,
    textureLoader,
    modules = [],
    activityState = {},
    isMobile = () => false
  } = ctx;

  const mode = options.mode || "preview";

  let world;
  let floor;
  let avatarMarker;
  let mounted = false;
  let hovered = null;

  const districts = [];
  const pulses = [];

  const DISTRICT_POSITIONS = {
    gallery: [-12, -3.2, -8],
    live: [-7, -2.2, -10],
    music: [-2, -1.8, -11],
    gaming: [4, -2.2, -10],
    sports: [9, -3.2, -8],
    store: [12, -4.6, -6],
    upload: [6, -5.2, -5],
    meta: [0, -5.6, -4],
    watch: [-10, -5.1, -5],
    profile: [10, -5.1, -5]
  };

  const COLORS = {
    gallery: 0xa855f7,
    live: 0xff3131,
    music: 0x38bdf8,
    gaming: 0x22c55e,
    sports: 0xf59e0b,
    store: 0xfacc15,
    upload: 0x60a5fa,
    meta: 0x00ff9d,
    watch: 0xffffff,
    profile: 0xfacc15
  };

  function makeTextTexture({
    title = "DISTRICT",
    subtitle = "",
    color = "#7cffaa"
  } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 384;

    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = "rgba(0,0,0,.66)";
    roundRect(c, 32, 32, 960, 320, 44);
    c.fill();

    c.strokeStyle = color;
    c.lineWidth = 5;
    roundRect(c, 32, 32, 960, 320, 44);
    c.stroke();

    c.fillStyle = "#ffffff";
    c.font = "900 74px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    c.textAlign = "center";
    c.fillText(title.toUpperCase(), 512, 160);

    c.fillStyle = color;
    c.font = "800 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    c.fillText(subtitle.toUpperCase(), 512, 225);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function mount() {
    if (mounted) return;

    world = new THREE.Group();
    world.name = "RB_META_WORLD_ENGINE";

    world.position.set(0, mode === "preview" ? -2.8 : -1.2, mode === "preview" ? -9 : -7);
    world.rotation.x = mode === "preview" ? -0.22 : -0.12;
    world.scale.setScalar(mode === "preview" ? 0.9 : 1.15);

    buildFloor();
    buildDistricts();
    buildAvatarMarker();

    scene.add(world);
    mounted = true;
  }

  function buildFloor() {
    floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 96),
      new THREE.MeshBasicMaterial({
        color: 0x03140b,
        transparent: true,
        opacity: mode === "preview" ? 0.42 : 0.62,
        depthWrite: false
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6.2;
    world.add(floor);

    for (let i = 0; i < 5; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4 + i * 2.5, 0.035, 10, 180),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xfacc15 : 0x00ff9d,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / 2;
      ring.position.y = -6.08;
      ring.userData.speed = 0.002 + i * 0.0007;

      pulses.push(ring);
      world.add(ring);
    }
  }

  function buildDistricts() {
    const worldModules = modules.filter((mod) =>
      [
        "gallery",
        "live",
        "music",
        "gaming",
        "sports",
        "store",
        "upload",
        "meta",
        "watch",
        "profile"
      ].includes(mod.key)
    );

    worldModules.forEach((mod) => {
      const district = createDistrict(mod);
      districts.push(district);
      world.add(district);
    });
  }

  function createDistrict(mod) {
    const group = new THREE.Group();
    group.name = `RB_DISTRICT_${mod.key}`;
    group.userData = {
      key: mod.key,
      title: mod.title,
      route: mod.key,
      clickable: true
    };

    const pos = DISTRICT_POSITIONS[mod.key] || [0, -4, -8];
    group.position.set(pos[0], pos[1], pos[2]);

    const color = COLORS[mod.key] || 0x00ff9d;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.55, 0.45, 36),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    base.position.y = -0.25;
    group.add(base);

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 2.8, 0.28),
      new THREE.MeshBasicMaterial({
        color: 0x050805,
        transparent: true,
        opacity: 0.88
      })
    );
    tower.position.y = 1.35;
    group.add(tower);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 3.05, 0.32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glow.position.y = 1.35;
    glow.position.z = 0.02;
    group.add(glow);

    if (mod.image) {
      const texture = textureLoader.load(mod.image);
      const imagePanel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 2.55),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.9
        })
      );

      imagePanel.position.y = 1.35;
      imagePanel.position.z = 0.18;
      group.add(imagePanel);
    }

    const labelTexture = makeTextTexture({
      title: `${mod.tag || mod.key} District`,
      subtitle: mod.title || "",
      color: `#${color.toString(16).padStart(6, "0")}`
    });

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.42),
      new THREE.MeshBasicMaterial({
        map: labelTexture,
        transparent: true,
        depthWrite: false
      })
    );

    label.position.y = 3.35;
    label.position.z = 0.24;
    group.add(label);

    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.07, 16, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    portal.position.y = 0.1;
    portal.position.z = 0.34;
    group.add(portal);

    group.userData.portal = portal;
    group.userData.baseScale = 1;
    group.userData.floatOffset = Math.random() * Math.PI * 2;

    return group;
  }

  function buildAvatarMarker() {
    avatarMarker = new THREE.Group();
    avatarMarker.position.set(0, -5.9, -2.2);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.15, 6, 12),
      new THREE.MeshBasicMaterial({
        color: 0x020402,
        transparent: true,
        opacity: 0.96
      })
    );

    body.position.y = 0.9;
    avatarMarker.add(body);

    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.055, 16, 96),
      new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    aura.rotation.x = Math.PI / 2;
    avatarMarker.add(aura);

    avatarMarker.userData.aura = aura;
    world.add(avatarMarker);
  }

  function update(t) {
    if (!world) return;

    const boost = activityState.liveActive ? 1.15 : 1;

    world.rotation.y = Math.sin(t * 0.18) * 0.035;

    pulses.forEach((ring, index) => {
      ring.rotation.z += ring.userData.speed * boost;
      ring.material.opacity = 0.11 + Math.sin(t * 1.2 + index) * 0.04;
    });

    districts.forEach((district, index) => {
      const float =
        Math.sin(t * 1.15 + district.userData.floatOffset) * 0.16;

      district.position.y += (DISTRICT_POSITIONS[district.userData.key]?.[1] + float - district.position.y) * 0.08;

      const activeBoost =
        hovered === district.userData.key ||
        (activityState.liveActive && district.userData.key === "live")
          ? 1.14
          : 1;

      district.scale.setScalar(
        district.userData.baseScale +
          Math.sin(t * 1.6 + index) * 0.018 +
          (activeBoost - 1)
      );

      const portal = district.userData.portal;
      if (portal) {
        portal.rotation.z += 0.025 * boost;
        portal.scale.setScalar(
          1 + Math.sin(t * 2.6 + index) * 0.09 + (activeBoost - 1)
        );
      }
    });

    if (avatarMarker?.userData?.aura) {
      avatarMarker.userData.aura.rotation.z += 0.025;
      avatarMarker.userData.aura.scale.setScalar(
        1 + Math.sin(t * 2.2) * 0.08
      );
    }
  }

  function onPointerMove() {}

  function onPointerDown() {}

  function onPointerUp(event) {
    if (!camera || !event) return;

    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const hits = raycaster.intersectObjects(districts, true);
    if (!hits.length) return;

    let current = hits[0].object;

    while (current && !current.userData?.clickable) {
      current = current.parent;
    }

    if (!current?.userData?.key) return;

    window.dispatchEvent(
      new CustomEvent("rb:module-select", {
        detail: {
          key: current.userData.key,
          title: current.userData.title,
          source: "meta-world-engine"
        }
      })
    );
  }

  function resize() {
    if (!world) return;

    const mobile = isMobile();

    if (mode === "preview") {
      world.position.set(0, mobile ? -2.95 : -2.6, mobile ? -8.8 : -9.4);
      world.scale.setScalar(mobile ? 0.78 : 0.92);
    } else {
      world.position.set(0, mobile ? -1.4 : -1.1, mobile ? -7.5 : -8.2);
      world.scale.setScalar(mobile ? 0.96 : 1.18);
    }
  }

  function destroy() {
    if (!world) return;

    scene.remove(world);

    world.traverse((obj) => {
      obj.geometry?.dispose?.();

      if (obj.material?.map) {
        obj.material.map.dispose?.();
      }

      obj.material?.dispose?.();
    });

    districts.length = 0;
    pulses.length = 0;
    world = null;
    mounted = false;
  }

  return {
    mount,
    update,
    resize,
    destroy,
    onPointerMove,
    onPointerDown,
    onPointerUp,

    setHovered(key = null) {
      hovered = key;
    },

    focusDistrict(key) {
      hovered = key;
    }
  };
}

console.log("RB META WORLD ENGINE READY");
