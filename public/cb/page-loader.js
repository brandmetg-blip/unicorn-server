(function () {
  function getCompliantContentPath() {
    const pathname = window.location.pathname;
    const dsMatch = pathname.match(/^\/cb(?:\/([^\/]+))?\/?(?:index\.html)?$/);
    if (dsMatch) {
      const subdir = dsMatch[1];
      if (!subdir) return `/cb/c/index.html`;
      // Skip redirecting ds1, ds2, ds3 to their -c versions
      if (subdir === 'ds2' || subdir === 'ds3') return null;
      if (!subdir.endsWith('-c') && subdir !== 'c') return `/cb/${subdir}-c/index.html`;
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
  if (pg && (pg === "tldr" || pg === "indexb")) {
    setPgValue(pg);
  }

  // If URL pg is missing or invalid, check storage
  if (!pg || (pg !== "tldr" && pg !== "indexb")) {
    const storedPg = getPgFromStorage();
    if (storedPg && (storedPg === "tldr" || storedPg === "indexb")) {
      pg = storedPg;
    }
  }

  // INVERTED LOGIC: redirect if pg is NOT 'tldr' or 'indexb'
  if (!pg || (pg !== "tldr" && pg !== "indexb")) {
    const compliantPagePath = getCompliantContentPath();
    if (compliantPagePath) {
      urlParams.delete("pg");
      const remainingParams = urlParams.toString();
      const redirectUrl =
        compliantPagePath + (remainingParams ? "?" + remainingParams : "");
      window.location.href = redirectUrl;
    }
  }
  // If pg is 'tldr' or 'indexb', stay on current page
})();