# Shared CSS Plan

## Goal

Consistency across `react-web-sdk`, `web-sdk_react`, and `web-sdk_angular` using the same class
names for the same patterns. Angular design/structure has highest priority (most mature). Plain CSS,
no build-tool dependency, same file copied to each implementation.

## Source of truth

`assets/reference-ui.css` at repo root. Consolidates:

- Angular `src/styles.css` — reset, CSS variables, base elements, nav, layout
- Angular `control-panel/index.scss` — `.control-panel`, `.btn` variants
- Angular `tracking-log/index.scss` — `.tracking-log`, `.tracking-log__type--*`
- Angular `entry-card/index.scss` — `.entry-card`, `.nested-children`, `.rich-text`
- React layout classes from `react-web-sdk/src/styles.css` — harmonised with Angular names

## Class mapping (old React → shared name)

| Old React class  | Shared class            | Source         |
| ---------------- | ----------------------- | -------------- |
| `.app-shell`     | `.app-shell`            | new (React)    |
| `.app-nav`       | `.app-nav`              | new (React)    |
| `.app-body`      | `.app-body`             | new (React)    |
| `.app-sidebar`   | `.app-sidebar`          | Angular (keep) |
| `.app-main`      | `.app-main`             | new (React)    |
| `.control-grid`  | `.control-panel__table` | Angular        |
| `.section-stack` | `.entry-grid`           | Angular        |

## Distribution (copy-script approach, no shared symlinks)

Each implementation gets:

```
"copy:css": "cp ../../assets/reference-ui.css ./src/reference-ui.css"  (angular)
"copy:css": "cp ../../assets/reference-ui.css ./public/reference-ui.css"  (rsbuild)
```

Wired into: `dev`, `build`, `serve:e2e`  
`index.html` gets `<link rel="stylesheet" href="/reference-ui.css">`  
Angular: `angular.json` styles array replaces `src/styles.css` with `src/reference-ui.css`  
Angular component SCSS files become empty (styles live in shared file now)

## Files changed

### New

- `assets/reference-ui.css`

### react-web-sdk

- `package.json` — add `copy:css`, prepend to `dev`/`build`/`serve:e2e`
- `index.html` — add `<link>` for `/reference-ui.css`
- `src/styles.css` — delete (replaced by shared file)
- `src/main.tsx` — remove `import './styles.css'`
- `src/App.tsx` — class names: `app-shell`, `app-nav`, `app-body`, `app-sidebar`, `app-main`
- `src/pages/HomePage.tsx` — `.control-grid` → `.control-panel__table`; `section-stack` →
  `entry-grid`
- `src/pages/PageTwoPage.tsx` — remove inline styles, use `entry-grid`/`page-section`
- `src/components/AnalyticsEventDisplay.tsx` — swap inline styles for `.tracking-log*` classes
- `playwright.config.mjs` — DELETE (the user asked to delete it)

### web-sdk_react

- `package.json` — add `copy:css`, prepend to `dev`/`build`/`serve:e2e`
- `index.html` — add `<link>` for `/reference-ui.css`
- `src/App.tsx` — remove inline styles, use shared class names
- `src/pages/HomePage.tsx` — remove inline styles, use shared class names
- `src/pages/PageTwoPage.tsx` — remove inline styles
- `src/components/AnalyticsEventDisplay.tsx` — swap inline styles for `.tracking-log*` classes

### web-sdk_angular

- `package.json` — add `copy:css`, prepend to `dev`/`build`/`serve:e2e`
- `angular.json` — `src/styles.css` → `src/reference-ui.css`
- `src/styles.css` — delete
- component SCSS files — empty out (styles live in reference-ui.css)

## Deleted

- `implementations/react-web-sdk/playwright.config.mjs`
- `implementations/react-web-sdk/src/styles.css`
- `implementations/web-sdk_angular/src/styles.css`
- `implementations/web-sdk_angular/src/app/components/control-panel/index.scss`
- `implementations/web-sdk_angular/src/app/components/tracking-log/index.scss`
- `implementations/web-sdk_angular/src/app/components/entry-card/index.scss`
