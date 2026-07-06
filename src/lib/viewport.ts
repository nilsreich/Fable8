/**
 * Virtual-keyboard handling, best API first:
 *
 * 1. VirtualKeyboard API (Chromium): keyboard overlays the page and reports
 *    its height as env(keyboard-inset-height) — the shell reserves that
 *    space via padding, everything above stays visible.
 * 2. interactive-widget=resizes-content in the viewport meta (Chromium
 *    fallback): the layout viewport itself shrinks.
 * 3. VisualViewport fallback (iPadOS/Safari, Firefox): the layout viewport
 *    does NOT shrink when the keyboard opens — pin the app shell to the
 *    visual viewport height via --app-height and undo Safari's auto-scroll.
 */
export function setupViewport() {
  const vk = (navigator as any).virtualKeyboard;
  if (vk) {
    try {
      vk.overlaysContent = true;
      return;
    } catch {
      // fall through to the VisualViewport handling
    }
  }

  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  const update = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      // Only pin while the keyboard actually shrinks the viewport —
      // otherwise let CSS (100dvh) rule so browser UI show/hide stays smooth.
      const keyboardOpen = window.innerHeight - vv.height > 50;
      if (keyboardOpen) {
        root.style.setProperty("--app-height", `${vv.height}px`);
        window.scrollTo(0, 0);
      } else {
        root.style.removeProperty("--app-height");
      }
    });
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
}
