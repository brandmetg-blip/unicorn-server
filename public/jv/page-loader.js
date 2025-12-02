/**
 * Page Loader - Bidirectional redirect based on tb parameter with domain preservation
 * Automatically runs when script loads - no function calls needed
 * 
 * BIDIRECTIONAL LOGIC:
 * - If on a -c page (compliant) and tb=vdrd is present: redirects to non-c page (aggressive content)
 * - If on a non-c page and tb=vdrd is NOT present: redirects to -c page (compliant content)
 * - Otherwise: stays on current page
 * 
 * PERSISTENCE:
 * - Stores valid tb values in localStorage and cookie for future visits
 * - Checks stored values when URL parameter is missing or invalid
 * 
 * DOMAIN PRESERVATION:
 * - Stores original domain when tb=vdrd is first detected
 * - Redirects users back to original domain if they land on different domain
 * - Ensures cookies remain accessible across domain switches
 * - Adds encoded domain parameter (dr) to ALL JVZoo links for universal domain preservation
 */

(function () {
  // Mark page-loader as initialized
  window.__PAGE_LOADER_INIT__ = true;
  
  // Domain preservation configuration
  const EXCLUDED_DOMAINS = [
    'jvzoo.com',
    'www.jvzoo.com',
    'clickbank.com',
    'www.clickbank.com',
    'digistore24.com',
    'www.digistore24.com',
    'buygoods.com',
    'www.buygoods.com'
  ];

  function getCurrentDomain() {
    return window.location.hostname.replace(/^www\./, '');
  }

  function isValidDomainForPreservation(domain) {
    // Exclude known affiliate network domains
    if (EXCLUDED_DOMAINS.includes(domain.toLowerCase())) {
      return false;
    }

    // Exclude localhost variations
    if (domain.startsWith('localhost') || domain.startsWith('127.0.0.1')) {
      return false;
    }

    // Must have at least one dot (proper domain)
    if (!domain.includes('.')) {
      return false;
    }

    return true;
  }

  function storeOriginalDomain() {
    const currentDomain = getCurrentDomain();
    if (isValidDomainForPreservation(currentDomain)) {
      try {
        localStorage.setItem('originalDomain', currentDomain);
        const expires = new Date();
        expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        document.cookie = `originalDomain=${currentDomain}; expires=${expires.toUTCString()}; path=/; domain=.${currentDomain.replace(/^[^.]+\./, '')}`;
      } catch (e) {
        console.log('Could not store original domain:', e);
      }
    }
  }

  function getStoredOriginalDomain() {
    try {
      const localStorageDomain = localStorage.getItem('originalDomain');
      if (localStorageDomain && isValidDomainForPreservation(localStorageDomain)) {
        return localStorageDomain;
      }
    } catch (e) {
      // localStorage might be disabled
    }

    // Try to get from cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'originalDomain' && value && isValidDomainForPreservation(value)) {
        return value;
      }
    }

    return null;
  }


  function shouldRedirectToDifferentDomain() {
    const currentDomain = getCurrentDomain();
    const originalDomain = getStoredOriginalDomain();

    // If we have an original domain stored and it's different from current
    if (originalDomain && originalDomain !== currentDomain && isValidDomainForPreservation(originalDomain)) {
      return originalDomain;
    }

    return null;
  }

  function redirectToOriginalDomain(targetDomain) {
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(currentUrl.pathname + currentUrl.search + currentUrl.hash, `https://${targetDomain}`);

    console.log(`Redirecting from ${getCurrentDomain()} to original domain: ${targetDomain} using HTTPS`);
    window.location.href = newUrl.toString();
  }

  function getAggressiveContentPath() {
    const pathname = window.location.pathname;
    const pathMatch = pathname.match(/^\/jv(?:\/([^\/]+))?\/?(?:index\.html)?$/);
    if (pathMatch) {
      const subdir = pathMatch[1];
      // If on /jv/c/, redirect to /jv/
      if (subdir === 'c') return `/jv/index.html`;
      // Skip redirecting support, refund-policy, ftc, and earnings-disclaimer directories
      if (subdir === 'support' || subdir === 'refund-policy' || subdir === 'ftc' || subdir === 'earnings-disclaimer') return null;
      // If on a -c subdirectory, redirect to non-c version
      if (subdir && subdir.endsWith('-c')) {
        const baseName = subdir.slice(0, -2); // Remove '-c' suffix
        return `/jv/${baseName}/index.html`;
      }
    }
    return null;
  }

  function getCompliantContentPath() {
    const pathname = window.location.pathname;
    const pathMatch = pathname.match(/^\/jv(?:\/([^\/]+))?\/?(?:index\.html)?$/);
    if (pathMatch) {
      const subdir = pathMatch[1];
      // If on /jv/, redirect to /jv/c/
      if (!subdir) return `/jv/c/index.html`;
      // Skip redirecting support, refund-policy, ftc, and earnings-disclaimer directories
      if (subdir === 'support' || subdir === 'refund-policy' || subdir === 'ftc' || subdir === 'earnings-disclaimer') return null;
      // If on a non-c subdirectory (us1, us2, ds1, etc.), redirect to -c version
      if (subdir && !subdir.endsWith('-c') && subdir !== 'c') {
        return `/jv/${subdir}-c/index.html`;
      }
    }
    return null;
  }

  function setTbValue(value) {
    try {
      localStorage.setItem('tb', value);
    } catch (e) {
      // localStorage might be disabled or full
    }

    const expires = new Date();
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    const currentDomain = getCurrentDomain();

    // Set cookie for current domain
    document.cookie = `tb=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    // Also try to set for parent domain (for cross-subdomain access)
    if (currentDomain.includes('.')) {
      const parentDomain = currentDomain.replace(/^[^.]+\./, '');
      document.cookie = `tb=${value}; expires=${expires.toUTCString()}; path=/; domain=.${parentDomain}; SameSite=Lax`;
    }
  }


  function getTbFromStorage() {
    try {
      const localStorageTb = localStorage.getItem('tb');
      if (localStorageTb) {
        return localStorageTb;
      }
    } catch (e) {
      // localStorage might be disabled
    }
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'tb') {
        return value;
      }
    }
    
    return null;
  }

  function getTbFromReferrer() {
    try {
      const referrer = document.referrer;
      console.log(referrer);
      if (!referrer) {
        return null;
      }
      
      const referrerUrl = new URL(referrer);
      const referrerParams = new URLSearchParams(referrerUrl.search);
      const referrerTb = referrerParams.get('tb');
      
      if (referrerTb && referrerTb === 'vdrd') {
        return referrerTb;
      }
    } catch (e) {
      // URL parsing might fail for invalid referrers
    }
    
    return null;
  }

  function getEncodedDomainParam() {
    const currentDomain = getCurrentDomain();
    if (isValidDomainForPreservation(currentDomain)) {
      return btoa(currentDomain);
    }
    return null;
  }

  // Prevent infinite redirects by checking for redirect counter
  const urlParams = new URLSearchParams(window.location.search);
  const redirectCount = parseInt(urlParams.get('_redirect') || '0');
  if (redirectCount >= 3) {
    console.log('Redirect limit reached, stopping to prevent infinite loop');
    return;
  }

  // Check for encoded domain parameter (dr) from JVZoo
  const drParam = urlParams.get('dr');
  if (drParam) {
    try {
      const decodedDomain = atob(drParam);
      if (isValidDomainForPreservation(decodedDomain)) {
        // Only redirect if we're not already on the correct domain
        const currentDomain = getCurrentDomain();
        if (currentDomain !== decodedDomain) {
          console.log(`Redirecting to encoded domain: ${decodedDomain}`);
          redirectToOriginalDomain(decodedDomain);
          return; // Stop execution, redirect is happening
        } else {
          console.log(`Already on correct domain: ${decodedDomain}, no redirect needed`);
        }
      }
    } catch (e) {
      console.log('Invalid encoded domain parameter:', e);
    }
  }

  // Domain preservation: check if we need to redirect to original domain first
  const targetDomain = shouldRedirectToDifferentDomain();
  if (targetDomain) {
    redirectToOriginalDomain(targetDomain);
    return; // Stop execution, redirect is happening
  }

  // Store current domain as original if this is a new visit with tb parameter
  const urlTb = urlParams.get("tb");
  if (urlTb && urlTb === "vdrd") {
    storeOriginalDomain();
  }

  let tb = null;

  // Check in priority order: URL -> storage -> referrer
  // 1. Check current URL first (highest priority)
  if (urlTb && urlTb === "vdrd") {
    tb = urlTb;
    setTbValue(tb); // Store for future visits
  }

  // 2. If no valid tb in URL, check storage (for returning users)
  if (!tb) {
    const storedTb = getTbFromStorage();
    if (storedTb && storedTb === "vdrd") {
      tb = storedTb;
    }
  }

  // 3. If no valid tb from URL or storage, check referrer
  if (!tb) {
    const referrerTb = getTbFromReferrer();
    if (referrerTb && referrerTb === "vdrd") {
      tb = referrerTb;
      setTbValue(tb); // Store for future visits
    }
  }

  // Expose tb value to calling pages via global variable
  window.tb = tb;

  // Add domain parameter to JVZoo links for ALL visitors (universal domain preservation)
  const encodedDomain = getEncodedDomainParam();
  console.log('Domain preservation check:', { 
    currentDomain: getCurrentDomain(), 
    encodedDomain: encodedDomain,
    isValidDomain: isValidDomainForPreservation(getCurrentDomain())
  });
  
  if (encodedDomain) {
    console.log('Adding domain parameter to JVZoo links:', encodedDomain);
    
    // Function to update JVZoo links
    function updateJvzooLinks() {
      const jvzooLinks = document.querySelectorAll('a[href*="jvzoo.com/b/"]');
      console.log('Found JVZoo links:', jvzooLinks.length);
      
      jvzooLinks.forEach((link, index) => {
        const url = new URL(link.href);
        if (!url.searchParams.has('dr')) {
          url.searchParams.set('dr', encodedDomain);
          link.href = url.toString();
          console.log(`Updated JVZoo link ${index + 1}:`, link.href);
        } else {
          console.log(`JVZoo link ${index + 1} already has dr param:`, link.href);
        }
      });
      
      // Emit event for JVZoo script to listen to
      document.dispatchEvent(new CustomEvent('jvzooLinksUpdated', {
        detail: { linkCount: jvzooLinks.length }
      }));
    }

    // Update links with multiple strategies to ensure it works
    function runDomainPreservation() {
      updateJvzooLinks();
      
      // Also try after a short delay to catch any late-loading content
      setTimeout(updateJvzooLinks, 100);
      setTimeout(updateJvzooLinks, 500);
      setTimeout(updateJvzooLinks, 1000);
    }

    // Update links immediately if DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runDomainPreservation);
    } else {
      runDomainPreservation();
    }

    // Also watch for dynamically added links
    const observer = new MutationObserver(function(mutations) {
      let shouldUpdate = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              if (node.matches && node.matches('a[href*="jvzoo.com/b/"]')) {
                shouldUpdate = true;
              }
              // Check for JVZoo links in added subtree
              if (node.querySelectorAll && node.querySelectorAll('a[href*="jvzoo.com/b/"]').length > 0) {
                shouldUpdate = true;
              }
            }
          });
        }
      });
      
      if (shouldUpdate) {
        console.log('New JVZoo links detected, updating...');
        updateJvzooLinks();
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      // If body doesn't exist yet, wait for it
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }
  } else {
    console.log('No encoded domain parameter generated - domain may not be valid for preservation');
  }

  // Bidirectional redirect logic
  if (tb === "vdrd") {
    const aggressivePagePath = getAggressiveContentPath();
    if (aggressivePagePath) {
      urlParams.set('_redirect', (redirectCount + 1).toString());
      const redirectUrl = aggressivePagePath + "?" + urlParams.toString();
      window.location.href = redirectUrl;
    }
  } else {
    const compliantPagePath = getCompliantContentPath();
    if (compliantPagePath) {
      urlParams.delete("tb");
      urlParams.set('_redirect', (redirectCount + 1).toString());
      const remainingParams = urlParams.toString();
      const redirectUrl = compliantPagePath + (remainingParams ? "?" + remainingParams : "");
      window.location.href = redirectUrl;
    }
  }
})();