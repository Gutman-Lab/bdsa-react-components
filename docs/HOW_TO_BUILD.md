# How to build

Prerequisites: **Node.js** with **npm** (versions aligned with repo practice; use recent LTS).

## Install

```bash
git clone https://github.com/Gutman-Lab/bdsa-react-components.git
cd bdsa-react-components
npm install
```

`postinstall` runs **`patch-package`** — required for locked dependency tweaks.

---

## Core commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Runs **`tsc`** then **`vite build`**. Outputs **`dist/`** (ESM + CJS, types, bundled CSS, and Pitt split schemas under **`dist/schemas/`**). |
| `npm test` | **Vitest** once (no watch). |
| `npm run lint` | **ESLint** on the tree (`dist` omitted by config). Use `npm run test:watch` / `npm run lint` workflows as usual while developing. |
| `npm run storybook` | Dev Storybook at **http://localhost:6006**. |
| `npm run build-storybook` | Static Storybook bundle under **`storybook-static/`**. |

---

## Typical release workflow

1. Ensure **`npm run build`** and **`npm test`** pass (and **`npm run lint`** if you maintain a clean tree across the repo).
2. Bump version and publish per **[PUBLISHING.md](PUBLISHING.md)** (`npm version`, `npm publish`, etc.).

`prepublishOnly` runs **`npm run build`** before **`npm publish`**, so the tarball always contains a fresh **`dist/`**.

---

## Docs and `LLM_INTEGRATION.md`

- **`docs/LLM_INTEGRATION.md`** is **maintained by hand** in git. It is **not** generated or updated by **`npm run build`** or **`npm publish`**.
- The **npm package** only ships what **`package.json` → `files`** lists (today: **`dist`**, **`patches`**, **`README.md`**, **`CHANGELOG.md`**, **`LICENSE`**). **`docs/*.md` are not published to npm** unless you explicitly add them to `files` (or copy content into the root `README`).

For consumers who need integration notes in-repo, keep **`LLM_INTEGRATION.md`** in **`docs/`** and version it with normal commits; copy snippets into other projects or Cursor rules as needed.
