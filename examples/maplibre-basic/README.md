# MapLibre example

Run the example from the repository root:

```bash
npm install
npm run example:open
```

The command generates the synthetic weather fixtures, starts Vite on a local
HTTP address, and opens the example in a browser.

The generated colors are a mathematical test pattern, not observed or
forecast weather. The example labels its timeline as synthetic and overlays a
10-degree coordinate grid so the declared coverage and orientation can be
checked visually without downloading a third-party base map.

Do not open `index.html` directly. A `file://` page cannot load TypeScript
modules, fetch local weather assets, or start the MapLibre worker because the
browser assigns local files an opaque origin.
