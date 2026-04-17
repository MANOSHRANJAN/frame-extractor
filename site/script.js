// site/script.js

// 1. Scroll Animations (Fade Up)
document.addEventListener("DOMContentLoaded", () => {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up').forEach(el => {
    observer.observe(el);
  });
});

// 2. OS Detection for Primary Download Buttons
// Determines Windows or Mac and updates the main CTA buttons
document.addEventListener("DOMContentLoaded", () => {
  const btnHeroDl = document.getElementById('btnHeroDl');
  const tableDlBtn = document.getElementById('tableDlBtn');
  const osHint = document.getElementById('osHint');
  const navDlBtn = document.getElementById('navDlBtn');
  
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  const isMac = platform.includes('mac') || userAgent.includes('mac');
  const isWin = platform.includes('win') || userAgent.includes('win');

  const macLink = "https://github.com/MANOSHRANJAN/frame-extractor/releases/latest/download/Frame-Extractor-macOS.dmg";
  const winLink = "https://github.com/MANOSHRANJAN/frame-extractor/releases/latest/download/Frame-Extractor-Windows.exe";

  const configOsBtn = (btn, isMacPlatform) => {
    if (!btn) return;
    if (isMacPlatform) {
      btn.href = macLink;
      btn.innerHTML = `<span class="dl-icon">↓</span> Download for Mac`;
      btn.setAttribute('data-platform', 'mac');
    } else {
      btn.href = winLink;
      btn.innerHTML = `<span class="dl-icon">↓</span> Download for Windows`;
      btn.setAttribute('data-platform', 'windows');
    }
  };

  if (isMac) {
    configOsBtn(btnHeroDl, true);
    configOsBtn(tableDlBtn, true);
    if(osHint) osHint.textContent = "Also available for Windows";
  } else if (isWin) {
    configOsBtn(btnHeroDl, false);
    configOsBtn(tableDlBtn, false);
    if(osHint) osHint.textContent = "Also available for macOS";
  } else {
    // Unknown - leave generic defaults. They just point to #download
    if(btnHeroDl) {
      btnHeroDl.innerHTML = `<span class="dl-icon">↓</span> Go to Downloads`;
      btnHeroDl.href = "#download";
    }
    if(tableDlBtn) {
      tableDlBtn.innerHTML = `Go to Downloads`;
      tableDlBtn.href = "#download";
    }
  }
});

// 3. Supabase Download Tracking
// Attach click listeners to any download link holding data-platform
document.addEventListener("DOMContentLoaded", () => {
  const SUPABASE_URL = "https://qqdnxzbhcavkzxhqqxdc.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_83Ezszua1qCzA-cC7jidcA_mnToRCb4";

  const trackDownload = async (platformStr) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/downloads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          platform: platformStr,
          version: "v1.0.0",
          user_agent: window.navigator.userAgent
        })
      });
      console.log("Download tracked.");
    } catch (err) {
      console.error("Failed to track download:", err);
    }
  };

  document.querySelectorAll('a').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      // Find what platform it is downloading
      let platInfo = anchor.getAttribute('data-platform');
      
      // If no strict data-platform but it links to a .dmg or .exe
      if(!platInfo && anchor.href.includes('.dmg')) platInfo = 'mac';
      if(!platInfo && anchor.href.includes('.exe')) platInfo = 'windows';
      
      if(platInfo) {
        trackDownload(platInfo);
      }
    });
  });
});
