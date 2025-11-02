## xiyou wrapper app

Desktop app that opens `https://student.xiyouyingyu.com/` in a native window and injects your custom JS/CSS.

### Run

```bash
pnpm i || npm i || yarn
npm run dev
```

Shortcuts:
- Ctrl+R: Reload page
- Ctrl+Shift+R: Hard reload
- Ctrl+Shift+I: Toggle DevTools
- Ctrl+Shift+J: Re-run injection

### Injection

Place your code in:
- `user/inject.js` – executed in page context after DOMContentLoaded
- `user/inject.css` – appended to the document as a <style>

Edits are not auto-watched; use Ctrl+Shift+J to re-run after saving.

### Current Injection Script

The `user/inject.js` file currently includes a Vue component controller that:
- Automatically finds the target element `div[data-v-6abbda0b].bar-right`
- Uses **pure MutationObserver** - 100% event-driven, **zero polling**!
- Creates two control buttons to set `audioTime` to 0 or 100
- Only runs on `mock-paper` pages by default
- Handles SPA navigation (hash routing) with immediate detection

**Event-driven approach**: 
- MutationObserver watches DOM structure changes (elements, attributes, text)
- No polling - only reacts to real DOM events
- Detects target element as soon as it's added to the DOM
- Captures Vue instance the moment it's bound to the element

Example CSS (in `user/inject.css`):

```css
html { background-color: #f8fff8 !important; }
```

### Build (Windows)

```bash
npm run pack:win
```

The output will be in `dist/`.

### Notes

- The target site is `https://student.xiyouyingyu.com/`.
- Injection is done via Electron preload to avoid CSP limitations.
- External links open in your default browser.


