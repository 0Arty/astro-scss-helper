# Astro SCSS Helper

VS Code extension that automatically extracts CSS classes from `.astro` files and provides autocomplete suggestions in SCSS and CSS.

---

## ✨ Features

- 🔍 Scans all `.astro` files in your workspace
- 🧠 Builds a global index of class names
- ⚡ Updates index in real time when files change
- 🎯 Autocomplete in `.scss` and `.css` when typing `.`
- 🧩 Supports:
   - `class="foo bar"`
   - `class='foo bar'`
   - ``class={`foo bar`} ``
   - `class:list={['foo', 'bar', { baz: true }]}`

---

## 🚀 Usage

1. Open your Astro project in VS Code
2. Open any `.scss` or `.css` file
3. Start typing a class:

```scss
.cont|
```

4. Get autocomplete suggestions from your `.astro` files 🎉

---

## 🔄 Commands

### `Astro SCSS Helper: Rescan Classes`

Manually rebuilds the class index.

---

## ⚙️ How it works

- On activation:
   - Scans all `.astro` files
   - Extracts class names into a global index
- Uses a file watcher:
   - Updates only changed files (no full rescan)
- Provides completion items when typing `.` in SCSS/CSS

---

## 📁 Supported Files

| Type     | Purpose               |
| -------- | --------------------- |
| `.astro` | Source of class names |
| `.scss`  | Autocomplete target   |
| `.css`   | Autocomplete target   |

---

## 🧠 Example

### Astro

```astro
<div class="container hero-title"></div>
```

### SCSS

```scss
.cont   // → .container
.hero   // → .hero-title
```

---

## ⚡ Performance

- Chunked file reading (20 files at a time)
- Incremental updates via file watcher
- Optimized for large projects

---

## 🛠 Development

```bash
npm install
code .
```

---

## 📦 Build Extension

```bash
npm install -g vsce
vsce package
```

---

## 🐛 Issues

If you find a bug or have a suggestion — open an issue.

---

## 📄 License

MIT License
