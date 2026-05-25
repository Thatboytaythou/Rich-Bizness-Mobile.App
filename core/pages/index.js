document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="max-w-6xl mx-auto px-6 pt-8 pb-24 relative z-10">
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

      <div class="dial-hub relative h-[680px] flex items-center justify-center mb-16">
        <div class="portal-ring w-[620px] h-[620px]"></div>
        <div class="portal-ring w-[480px] h-[480px]" style="animation-duration: 28s;"></div>

        <div onclick="goLive()" class="phone-mockup w-80 relative z-30 cursor-pointer">
          <div class="bg-zinc-950 rounded-3xl h-[560px] flex flex-col items-center justify-center text-center p-8">
            <div class="w-32 h-32 bg-gradient-to-br from-emerald-400 to-amber-500 rounded-3xl flex items-center justify-center mb-10">
              <i class="fa-solid fa-broadcast-tower text-7xl text-black"></i>
            </div>
            <h2 class="text-4xl font-bold mb-3">Go Live</h2>
            <p class="text-emerald-400">ENTER THE SMOKE</p>
          </div>
        </div>

        <!-- More orbiting phones added as requested -->
        <div onclick="selectModule('feed')" class="orbital-phone phone-mockup" style="top:8%;left:12%;">Feed</div>
        <div onclick="selectModule('live')" class="orbital-phone phone-mockup" style="top:15%;right:10%;">Live</div>
        <div onclick="selectModule('gaming')" class="orbital-phone phone-mockup" style="bottom:12%;left:8%;">Gaming</div>
        <div onclick="selectModule('sports')" class="orbital-phone phone-mockup" style="bottom:18%;right:15%;">Sports</div>
        <div onclick="selectModule('music')" class="orbital-phone phone-mockup" style="top:22%;left:18%;">Music</div>
        <div onclick="selectModule('podcast')" class="orbital-phone phone-mockup" style="top:28%;right:20%;">Podcast</div>
        <div onclick="selectModule('radio')" class="orbital-phone phone-mockup" style="bottom:25%;left:22%;">Radio</div>
        <div onclick="selectModule('gallery')" class="orbital-phone phone-mockup" style="top:35%;left:25%;">Gallery</div>
        <div onclick="selectModule('upload')" class="orbital-phone phone-mockup" style="bottom:22%;right:18%;">Upload</div>
        <div onclick="selectModule('store')" class="orbital-phone phone-mockup" style="top:45%;left:15%;">Store</div>
        <div onclick="selectModule('meta')" class="orbital-phone phone-mockup" style="bottom:35%;right:12%;">Meta</div>
      </div>

      <div class="text-center mb-16">
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

  window.goLive = () => alert("🌫️ Entering the Smoke Portal...");
  window.selectModule = (mod) => alert(`Entering ${mod.toUpperCase()} Realm...`);
  window.selectTab = (tab) => alert(`Opening ${tab}...`);
});
