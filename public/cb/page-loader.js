/**
 * Page Loader - Auto-detection and loading of compliant content based on pg parameter
 * Automatically runs when script loads - no function calls needed
 * 
 * INVERTED LOGIC:
 * - If pg=vdrd or pg=indexb is present: stays on current page (shows aggressive content)
 * - If pg is missing or invalid: redirects to -c directory (compliant content)
 * 
 * PERSISTENCE:
 * - Stores valid pg values in localStorage and cookie for future visits
 * - Checks stored values when URL parameter is missing or invalid
 */

(function () {
  function getCompliantContentPath() {
    const pathname = window.location.pathname;
    const dsMatch = pathname.match(/^\/ds(?:\/([^\/]+))?\/?(?:index\.html)?$/);
    if (dsMatch) {
      const subdir = dsMatch[1];
      if (!subdir) return `/ds/c/index.html`;
      // Skip redirecting ds1, ds2, ds3 to their -c versions
      if (subdir === 'ds4' || subdir === 'ds5') return null;
      if (!subdir.endsWith('-c') && subdir !== 'c') return `/ds/${subdir}-c/index.html`;
    }
    return null;
  }

  function setPgValue(value) {
    try {
      localStorage.setItem('pg', value);
    } catch (e) {
      // localStorage might be disabled or full
    }
    
    const expires = new Date();
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    document.cookie = `pg=${value}; expires=${expires.toUTCString()}; path=/`;
  }

  function getPgFromStorage() {
    try {
      const localStoragePg = localStorage.getItem('pg');
      if (localStoragePg) {
        return localStoragePg;
      }
    } catch (e) {
      // localStorage might be disabled
    }
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'pg') {
        return value;
      }
    }
    
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  let pg = urlParams.get("pg");

  // If URL pg is valid, store it
  if (pg && (pg === "vdrd" || pg === "indexb")) {
    setPgValue(pg);
  }

  // If URL pg is missing or invalid, check storage
  if (!pg || (pg !== "vdrd" && pg !== "indexb")) {
    const storedPg = getPgFromStorage();
    if (storedPg && (storedPg === "vdrd" || storedPg === "indexb")) {
      pg = storedPg;
    }
  }

  // INVERTED LOGIC: redirect if pg is NOT 'vdrd' or 'indexb'
  if (!pg || (pg !== "vdrd" && pg !== "indexb")) {
    const compliantPagePath = getCompliantContentPath();
    if (compliantPagePath) {
      urlParams.delete("pg");
      const remainingParams = urlParams.toString();
      const redirectUrl =
        compliantPagePath + (remainingParams ? "?" + remainingParams : "");
      window.location.href = redirectUrl;
    }
  }
  // If pg is 'vdrd' or 'indexb', stay on current page
})();