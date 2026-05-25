// =============================================
// CORE PAGES - INDEX
// Full Universe Hub with Orbiting Cards
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  const modules = [
    { name: 'feed', label: 'Feed', icon: '📱' },
    { name: 'live', label: 'Live', icon: '📡' },
    { name: 'gaming', label: 'Gaming', icon: '🎮' },
    { name: 'sports', label: 'Sports', icon: '🏟️' },
    { name: 'music', label: 'Music', icon: '🎵' },
    { name: 'podcast', label: 'Podcast', icon: '🎙️' },
    { name: 'radio', label: 'Radio', icon: '📻' },
    { name: 'gallery', label: 'Gallery', icon: '🖼️' },
    { name: 'upload', label: 'Upload', icon: '⬆️' },
    { name: 'store', label: 'Store', icon: '🛒' },
    { name: 'meta', label: 'Meta', icon: '🌐' }
  ];

  app.innerHTML = `
    <div class="max-w-6xl mx-auto px-6 pt-8 pb-24 relative z-10">
      <!-- Header -->
      <div class="glass-smoke rounded-3xl p-6 flex justify-between items-center mb-12">
        <div>
          <h1 class="text-5xl font-black tracking-tighter">RICH <span class="burnt-gold">BIZNESS</span></h1>
          <p class="text-gray-400">LLC • SMOKE & EMPIRE</p>
        </div>
        <div class="px-6 py-3 bg-emerald-500/10 border border-emerald-500 rounded-full flex items-center gap-3">
          <div class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          <span class="font-medium">LIVE</span>
        </div>
      </div>

      <!-- Orbit Hub -->
      <div class="relative h-[720px] flex items-center justify-center mb-16 perspective-container" id="orbit-hub">
        <div class="portal-ring"></div>
        <div class="portal-ring" style="animation-duration: 32s;"></div>

        <!-- Central Go Live -->
        <div onclick="goLive()" class="phone-mockup w-80 relative z-30 cursor-pointer" id="central-card">
          <div class="bg-zinc-950 rounded-3xl h-[560px] flex flex-col items-center justify-center text-center p-8">
            <div class="w-32 h-32 bg-gradient-to-br from-emerald-400 to-amber-500 rounded-3xl flex items-center justify-center mb-10">
              <i class="fa-solid fa-broadcast-tower text-7xl text-black"></i>
            </div>
            <h2 class="text-4xl font-bold mb-3">Go Live</h2>
            <p class="text-emerald-400">ENTER THE SMOKE</p>
          </div>
        </div>
      </div>

      <!-- Hero -->
      <div class="text-center">
        <h2 class="text-6xl font-black tracking-tighter">ALL IN ONE <span class="burnt-gold">UNIVERSE</span></h2>
        <p class="text-emerald-400 text-2xl mt-4">SMOKE • POWER • LEGACY</p>
      </div>
    </div>

    <!-- Bottom Tab Bar -->
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 glass-smoke rounded-3xl px-8 py-4 flex gap-8 text-sm z-50">
      <button onclick="selectTab('profile')" class="flex flex-col items-center"><i class="fa-solid fa-user"></i><span class="text-xs mt-1">Profile</span></button>
      <button onclick="selectTab('watch')" class="flex flex-col items-center"><i class="fa-solid fa-tv"></i><span class="text-xs mt-1">Watch</span></button>
      <button onclick="selectTab('notifications')" class="flex flex-col items-center"><i class="fa-solid fa-bell"></i><span class="text-xs mt-1">Alerts</span></button>
      <button onclick="selectTab('messages')" class="flex flex-col items-center"><i class="fa-solid fa-comments"></i><span class="text-xs mt-1">Messages</span></button>
    </div>
  `;

  const hub = document.getElementById('orbit-hub');
  let currentScale = 1;
  let targetScale = 1;
  const minScale = 0.65;
  const maxScale = 1.85;
  let isZooming = false;

  const cards = [];

  // Create Orbiting Cards
  const radius = 265;
  const centerX = 310;
  const centerY = 340;

  modules.forEach((mod, i) => {
    const angle = (i * (360 / modules.length)) * (Math.PI / 180);
    const x = centerX + radius * Math.cos(angle) - 70;
    const y = centerY + radius * Math.sin(angle) - 70;

    const card = document.createElement('div');
    card.className = `orbital-phone`;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.innerHTML = `
      <div class="phone-mockup">
        <div class="card-content">
          <div class="icon">${mod.icon}</div>
          <div class="label">${mod.label}</div>
        </div>
      </div>
    `;
    card.onclick = () => selectModule(mod.name);
    hub.appendChild(card);
    cards.push(card);
  });

  // Smooth Zoom Animation
  function animateZoom() {
    if (!isZooming) return;
    currentScale = currentScale * 0.82 + targetScale * 0.18;
    if (Math.abs(currentScale - targetScale) < 0.005) isZooming = false;
    hub.style.transform = `scale(${currentScale})`;
    requestAnimationFrame(animateZoom);
  }

  hub.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.085 : 0.085;
    targetScale = Math.max(minScale, Math.min(maxScale, targetScale + delta));
    isZooming = true;
    animateZoom();
  });

  hub.addEventListener('dblclick', () => {
    targetScale = 1;
    isZooming = true;
    animateZoom();
  });

  // Global Functions
  window.goLive = () => alert("🌫️ Entering the Smoke Portal...");
  window.selectModule = (mod) => alert(`Entering ${mod.toUpperCase()} Realm...`);
  window.selectTab = (tab) => alert(`Opening ${tab}...`);
});
