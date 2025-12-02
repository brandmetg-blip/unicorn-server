;(function(){
    if (window.__JVZ_B_LINK_INIT__) return;
    window.__JVZ_B_LINK_INIT__ = true;
  
    // ===== Options =====
    const REWRITE_ENABLED = true;                 // when true: add ALL page params to /b/ links
    const ALWAYS_PASS = ['aid','coupon'];         // always added to /b/ links (lowercased keys)
    const FALLBACK_PRODUCT_ID = '';               // optional fallback if no IDs found (e.g. '123456')
    const FIRE_TTL_MS = 30 * 1000;                // "already fired" time-to-live: 1 minute
    const THROTTLE_MS = 1500;                     // cross-instance throttle between fires
  
    // ===== State =====
    const FIRED_MAP = window.__JVZ_B_LINK_FIRED__ || (window.__JVZ_B_LINK_FIRED__ = Object.create(null)); // key -> timestamp
    const firedKey = (aid, productId, tid) => [aid || '', productId || '', tid || ''].join('|');
  
    const hasFired = (aid, productId, tid) => {
      const k = firedKey(aid, productId, tid);
      const now = Date.now();
  
      // memory check
      const memTs = Number(FIRED_MAP[k]);
      if (Number.isFinite(memTs) && now - memTs < FIRE_TTL_MS) return true;
  
      // sessionStorage check (+back-compat)
      try {
        const raw = sessionStorage.getItem('jvzFired:' + k);
        if (raw == null) return false;
  
        if (raw === '1') { // legacy value -> convert to timestamp and honor TTL from now
          sessionStorage.setItem('jvzFired:' + k, String(now));
          FIRED_MAP[k] = now;
          return true;
        }
  
        const ts = Number(raw);
        if (!Number.isFinite(ts)) return false;
  
        if (now - ts < FIRE_TTL_MS) {
          FIRED_MAP[k] = ts;
          return true;
        } else {
          sessionStorage.removeItem('jvzFired:' + k);
          delete FIRED_MAP[k];
          return false;
        }
      } catch (_) {
        return Number.isFinite(memTs) && (Date.now() - memTs < FIRE_TTL_MS);
      }
    };
  
    const markFired = (aid, productId, tid) => {
      const k = firedKey(aid, productId, tid);
      const now = Date.now();
      FIRED_MAP[k] = now;
      try { sessionStorage.setItem('jvzFired:' + k, String(now)); } catch(_) {}
    };
  
    // failure-only debug helper
    const DEBUG = true;
    const dbgFail = (...args) => {
      if (DEBUG && typeof console !== 'undefined') {
        (console.debug || console.log).apply(console, ['[JVZ]', ...args]);
      }
    };
  
    // ===== 1) Normalize page params (aid/tid lowercased, others preserved) =====
    const qp = new URLSearchParams(window.location.search);
    const pageParams = new URLSearchParams();
    for (const [key, value] of qp.entries()) {
      const kLower = key.toLowerCase();
      if (kLower === 'aid' || kLower === 'tid' || kLower === 'coupon') {
        pageParams.set(kLower, value);
      } else {
        pageParams.set(key, value);
      }
    }
    const aidRaw = pageParams.get('aid');
    const tidRaw = pageParams.get('tid');
  
    // ===== 2) Parse JVZoo URLs (supports /b/... and pixel form /.../..../...) =====
    function parseJVZUrl(url) {
      try {
        const u = new URL(url, window.location.href);
        if (!/(\.|^)jvzoo\.com$/i.test(u.hostname)) return null;
  
        // Supports:
        //   /b/{funnel}/{product}/{button}
        //   /{funnel}/{product}/{button}   (e.g. i.jvzoo.com/182/46/99)
        const m = u.pathname.match(/^\/(?:[bB]\/)?(\d+)\/(\d+)\/(\d+)(?:[\/?#]|$)/);
        if (!m) return null;
        return { url: u, funnelId: m[1], productId: m[2], buttonId: m[3] };
      } catch {
        return null;
      }
    }
  
    // Scan for first match in anchors, areas, images, iframes
    function findFirstIdsOnPage() {
      const nodes = document.querySelectorAll('a[href], area[href], img[src], iframe[src]');
      for (const el of nodes) {
        const url = el.getAttribute('href') || el.getAttribute('src');
        if (!url) continue;
        const info = parseJVZUrl(url);
        if (info) return { funnelId: info.funnelId, productId: info.productId };
      }
      return null;
    }
  
    // ===== 3) Fire the click once =====
    if (typeof window.__JVZ_LAST_CLICK_TS__ !== 'number') window.__JVZ_LAST_CLICK_TS__ = 0;
  
    function fireClickOnce() {
      if (!aidRaw) { dbgFail('click: skip -> missing aid'); return; }
  
      let ids = findFirstIdsOnPage();
      let productId = ids && ids.productId;
      if (!productId) {
        if (FALLBACK_PRODUCT_ID && /^\d+$/.test(String(FALLBACK_PRODUCT_ID))) {
          productId = String(FALLBACK_PRODUCT_ID);
        } else {
          dbgFail('click: skip -> no jvzoo id found in DOM and no valid FALLBACK_PRODUCT_ID');
          return;
        }
      }
  
      const now = Date.now();
      if (now - window.__JVZ_LAST_CLICK_TS__ < THROTTLE_MS) {
        dbgFail('click: skip -> throttled', { last: window.__JVZ_LAST_CLICK_TS__, now, delta: now - window.__JVZ_LAST_CLICK_TS__ });
        return;
      }
  
      if (hasFired(aidRaw, productId, tidRaw)) {
        dbgFail('click: skip -> already fired for key (within TTL)', { aid: aidRaw, productId, tid: tidRaw });
        return;
      }
  
      const clickUrl = new URL(`https://www.jvzoo.com/c/${encodeURIComponent(aidRaw)}/${productId}`);
      pageParams.forEach((v, k) => clickUrl.searchParams.set(k, v));
  
      const iframe = document.createElement('iframe');
      iframe.src = clickUrl.toString();
      iframe.style.cssText = 'width:0;height:0;border:0;position:absolute;left:-9999px;top:-9999px;';
      (document.body || document.documentElement).appendChild(iframe);
  
      window.__JVZ_LAST_CLICK_TS__ = now;
      markFired(aidRaw, productId, tidRaw);
    }
  
    // ===== 4) Safe Link Rewriting with Conflict Prevention =====
    let isUpdatingLinks = false; // Prevent infinite loops
    
    function updateBuyLinks () {
      if (isUpdatingLinks) {
        console.log('[JVZ] Skipping link update - already in progress');
        return;
      }
      
      isUpdatingLinks = true;
      
      try {
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          const info = parseJVZUrl(href);
          if (!info) return;
  
          // Check if this link has already been processed by our script
          if (a.dataset.jvzProcessed === 'true') return;
  
          // Start from canonical origin+pathname (preserves funnel/product/button ids)
          const newUrl = new URL(info.url.origin + info.url.pathname);
  
          // (a) copy the link's own original QS parameters first
          info.url.searchParams.forEach((v, k) => newUrl.searchParams.set(k, v));
  
          // (b1) always overlay whitelisted params from page
          pageParams.forEach((v, k) => {
            if (ALWAYS_PASS.includes(k.toLowerCase())) {
              newUrl.searchParams.set(k, v);
            }
          });
  
          // (b2) optionally overlay ALL other page params when enabled
          if (REWRITE_ENABLED) {
            pageParams.forEach((v, k) => {
              if (!ALWAYS_PASS.includes(k.toLowerCase())) {
                newUrl.searchParams.set(k, v);
              }
            });
          }
  
          // CRITICAL: Preserve existing dr parameter from page-loader if present
          const existingDr = info.url.searchParams.get('dr');
          if (existingDr) {
            newUrl.searchParams.set('dr', existingDr);
          }
  
          // Mark as processed to prevent re-processing
          a.dataset.jvzProcessed = 'true';
          a.setAttribute('href', newUrl.toString());
        });
      } finally {
        isUpdatingLinks = false;
      }
    }
  
    // ===== 5) Coordinated Observer System =====
    let observerTimeout = null;
    
    function debouncedUpdate() {
      if (observerTimeout) {
        clearTimeout(observerTimeout);
      }
      
      observerTimeout = setTimeout(() => {
        updateBuyLinks();
        fireClickOnce();
      }, 100); // 100ms debounce
    }
  
    // ===== 6) Integration with Page-Loader =====
    function init(){
      updateBuyLinks();
      fireClickOnce();
  
      // Check if page-loader is present and coordinate with it
      if (window.__PAGE_LOADER_INIT__) {
        console.log('[JVZ] Page-loader detected, using coordinated approach');
        
        // Listen for page-loader's link updates
        document.addEventListener('jvzooLinksUpdated', debouncedUpdate);
        
        // Also watch for new links being added (but not href changes to avoid conflicts)
        const observer = new MutationObserver(records => {
          if (isUpdatingLinks) return; // Don't process mutations during our own updates
  
          let shouldUpdate = false;
          for (const rec of records) {
            // Only watch for NEW nodes being added, not href changes (to avoid infinite loops)
            for (const node of rec.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (
                (node.matches && node.matches('a[href*="/b/"]')) ||
                (node.querySelector && node.querySelector('a[href*="/b/"]'))
              ) { shouldUpdate = true; break; }
            }
            if (shouldUpdate) break;
          }
          if (shouldUpdate) {
            debouncedUpdate();
          }
        });
  
        observer.observe(document.body, {
          childList: true,
          subtree: true
          // Removed attributes watching to prevent infinite loops with page-loader
        });
        
      } else {
        console.log('[JVZ] Page-loader not detected, using standalone approach');
        
        // Standalone observer for when page-loader isn't present
        const observer = new MutationObserver(records => {
          if (isUpdatingLinks) return; // Don't process mutations during our own updates
  
          let shouldUpdate = false;
          for (const rec of records) {
            // also catch href changes on existing anchors (only when page-loader not present)
            if (rec.type === 'attributes' && rec.attributeName === 'href' && rec.target instanceof Element) {
              if (rec.target.matches && rec.target.matches('a[href*="/b/"]')) { shouldUpdate = true; break; }
            }
            for (const node of rec.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (
                (node.matches && node.matches('a[href*="/b/"]')) ||
                (node.querySelector && node.querySelector('a[href*="/b/"]'))
              ) { shouldUpdate = true; break; }
            }
            if (shouldUpdate) break;
          }
          if (shouldUpdate) {
            debouncedUpdate();
          }
        });
  
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['href']
        });
      }
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  })();