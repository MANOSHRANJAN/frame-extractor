document.addEventListener("DOMContentLoaded", () => {
    
    // --- Scroll Animations (Intersection Observer) ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));


    // --- OS Detection Download Button Logic ---
    const platform = window.navigator.platform.toLowerCase();
    const heroBtn = document.getElementById('heroDlBtn');
    const tableBtn = document.getElementById('tableDlBtn');
    const navBtn = document.getElementById('navDlBtn');
    const osHint = document.getElementById('osHint');
    
    const macUrl = "https://github.com/MANOSHRANJAN/frame-extractor/releases/latest/download/Frame-Extractor-macOS.dmg";
    const winUrl = "https://github.com/MANOSHRANJAN/frame-extractor/releases/latest/download/Frame-Extractor-Windows.exe";
    let detectedOS = 'other';

    if (platform.includes('mac')) {
        detectedOS = 'mac';
        heroBtn.innerHTML = '<span class="dl-icon">↓</span> Download for Mac';
        osHint.innerText = 'Also available for Windows (.exe)';
        [heroBtn, tableBtn, navBtn].forEach(b => { if(b) b.href = macUrl; });
    } 
    else if (platform.includes('win')) {
        detectedOS = 'windows';
        heroBtn.innerHTML = '<span class="dl-icon">↓</span> Download for Windows';
        osHint.innerText = 'Also available for macOS (.dmg)';
        [heroBtn, tableBtn, navBtn].forEach(b => { if(b) b.href = winUrl; });
    }
    
    // Convert button clicks to anchors programmatically if they are buttons
    [heroBtn, tableBtn, navBtn].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            if (btn.tagName === 'BUTTON') {
                e.preventDefault();
                trackDownload(detectedOS);
                window.location.href = btn.href || (detectedOS === 'mac' ? macUrl : winUrl);
            } else {
                trackDownload(detectedOS);
            }
        });
    });

    // Also bind explicit platform buttons in the footer
    document.querySelectorAll('.dl-buttons a').forEach(a => {
        a.addEventListener('click', (e) => trackDownload(a.getAttribute('data-platform')));
    });


    // --- Supabase Download Tracking ---
    const SUPABASE_URL = "https://qqdnxzbhcavkzxhqqxdc.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_83Ezszua1qCzA-cC7jidcA_mnToRCb4";

    function trackDownload(osType) {
        if (SUPABASE_URL.includes("YOUR_SUPABASE")) {
            console.log(`[Tracking Stub] Download initiated for: ${osType}`);
            return;
        }

        // Send a tracking beacon
        fetch(`${SUPABASE_URL}/rest/v1/downloads`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                platform: osType,
                version: '1.0.0',
                user_agent: navigator.userAgent,
                // country can be populated later if using Edge Functions, else omit
            }),
            keepalive: true // Ensures request finishes even if page unloads
        }).catch(err => console.error("Tracking error:", err));
    }
});
