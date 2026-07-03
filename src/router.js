/**
 * Hash-based router. Hash routing is used deliberately: it works on static
 * hosting (GitHub Pages) with no server rewrites, which fits the zero-backend
 * architecture (rule a).
 */

/**
 * @param {Array<{path:string}>} routes
 * @param {string} defaultPath
 * @param {(route:object)=>void} onChange
 */
export function createRouter(routes, defaultPath, onChange) {
  function parse() {
    const path = location.hash.replace(/^#\/?/, '').split('?')[0];
    return routes.find((r) => r.path === path) || routes.find((r) => r.path === defaultPath) || routes[0];
  }

  function go(path) {
    if (location.hash === `#/${path}`) return;
    location.hash = `#/${path}`;
  }

  window.addEventListener('hashchange', () => onChange(parse()));

  return {
    go,
    current: parse,
    start() {
      if (!location.hash) {
        location.replace(`#/${defaultPath}`);
      }
      onChange(parse());
    },
  };
}
