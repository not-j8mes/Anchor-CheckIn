// Prevents @tailwindcss/node from spawning a Worker thread via module.register()
// in resource-constrained environments. Tailwind falls back to jiti for module
// loading, which works fine for standard Vite + Tailwind v4 setups.
const m = require('module');
const orig = m.register?.bind(m);
if (orig) {
  m.register = function (specifier, ...rest) {
    if (typeof specifier === 'string' && specifier.includes('tailwindcss')) return;
    return orig(specifier, ...rest);
  };
}
