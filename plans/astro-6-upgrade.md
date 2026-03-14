# Astro 6 Upgrade Plan

## Current State

The project is **already on Astro 6.0.4** with Node 22.22.0. The core upgrade happened
without issues because the project avoids all major breaking changes:

- No `Astro.glob()` usage (removed in v6)
- No `<ViewTransitions />` (replaced by `<ClientRouter />` in v6)
- No content collections (legacy collections removed in v6)
- No Zod schemas (Zod upgraded to v4 in Astro 6)
- No `import.meta.env.ASSETS_PREFIX` (deprecated in v6)
- Astro config is already `.mjs` (CJS config support dropped in v6)

### Installed Versions

| Package | Specifier | Installed |
|---------|-----------|-----------|
| astro | ^6.0.4 | 6.0.4 |
| @astrojs/cloudflare | ^13.1.1 | 13.1.1 |
| @astrojs/tailwind | ^6.0.2 | 6.0.2 |
| tailwindcss | ^3.4.19 | 3.4.19 |
| @tailwindcss/forms | ^0.5.11 | 0.5.11 |
| typescript | ^5.7.0 | 5.9.3 |
| wrangler | ^4.69.0 | 4.73.0 |

## Remaining Work: Tailwind v3 → v4 Migration

The one significant modernization left is migrating from the **deprecated**
`@astrojs/tailwind` integration (Tailwind v3) to `@tailwindcss/vite` (Tailwind v4).

`@astrojs/tailwind` v6 exists only as a compatibility shim — it won't get new features.
Tailwind v4 uses a CSS-first configuration approach and a Vite plugin instead of an
Astro integration.

### Steps

#### 1. Install Tailwind v4 and its Vite plugin
```bash
npm install tailwindcss@4 @tailwindcss/vite
```

#### 2. Remove deprecated packages
```bash
npm uninstall @astrojs/tailwind @tailwindcss/forms
```
Note: `@tailwindcss/forms` is not needed in Tailwind v4 — form styles are available
via `@plugin "@tailwindcss/forms"` or built-in utilities.

#### 3. Update `astro.config.mjs`

**Before:**
```js
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind({ applyBaseStyles: false })],
});
```

**After:**
```js
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

#### 4. Migrate `tailwind.config.cjs` → CSS-based config

Tailwind v4 uses CSS `@theme` blocks instead of a JS config file. Move the custom
theme from `tailwind.config.cjs` into the global CSS file (`src/styles/global.css`).

**Delete `tailwind.config.cjs` and update `global.css`:**

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";

@theme {
  --color-bg-primary: #0a0a0a;
  --color-bg-secondary: #1a1a1a;
  --color-bg-tertiary: #2a2a2a;
  --color-wordle-green: #6aaa64;
  --color-wordle-yellow: #c9b458;
  --color-accent-blue: #1e90ff;
  --color-accent-purple: #a855f7;
  --color-accent-red: #ef4444;
  --color-accent-green: #22c55e;
  --color-text-primary: #fdfdfd;
  --color-text-secondary: #9ca3af;
  --font-family-outfit: "Outfit", sans-serif;
}
```

#### 5. Update CSS syntax

Tailwind v4 changes:
- `@apply` still works but scoped `<style>` blocks in `.astro` files need
  `@reference "tailwindcss"` at the top to resolve utility classes
- Review all `<style>` blocks in components for `@apply` usage and add the reference
- `@layer base` / `@layer components` syntax may need adjustment

#### 6. Verify the `@tailwindcss/forms` plugin

In Tailwind v4, install the forms plugin separately if needed:
```bash
npm install @tailwindcss/forms@next
```
Then reference it in CSS: `@plugin "@tailwindcss/forms";`

#### 7. Test everything
```bash
npm run build
npm run dev
```
Visually verify the dashboard looks correct — color tokens, fonts, form inputs,
responsive layout, animations.

## Optional: Cloudflare Adapter Improvements

Astro 6's `@astrojs/cloudflare` v13 now uses the Cloudflare Vite plugin to run
`workerd` during development. This means `astro dev` uses the real Workers runtime
instead of Node.js. This should already be working with the current v13.1.1 install.

Verify with:
```bash
npm run dev
```
Confirm D1 bindings work in local dev via `platformProxy`.

## References

- [Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Astro 6 blog post](https://astro.build/blog/astro-6/)
- [Tailwind v4 with Astro guide](https://tailkits.com/blog/astro-tailwind-setup/)
- [Tailwind v4 upgrade for Astro](https://bhdouglass.com/blog/how-to-upgrade-your-astro-site-to-tailwind-v4/)
- [@astrojs/cloudflare docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
