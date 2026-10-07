import type { Action } from 'svelte/action';

// A click keeps native caret placement. Crossing the ordinary item drag
// threshold hands the original press to the editor on a stable item surface.
export const nameDrag: Action<
  HTMLInputElement,
  (down: PointerEvent, move: PointerEvent, surface: HTMLElement) => void
> = (input, start) => {
  let down: PointerEvent | null = null;
  const surface = input.parentElement!;
  function clear() {
    down = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', clear);
    window.removeEventListener('pointercancel', clear);
    window.removeEventListener('blur', clear);
  }
  function move(event: PointerEvent) {
    if (
      !down ||
      event.pointerId !== down.pointerId ||
      Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < 4
    )
      return;
    const press = down;
    clear();
    start(press, event, surface);
  }
  function press(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    clear();
    down = event;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
  }
  input.addEventListener('pointerdown', press);
  return {
    destroy() {
      clear();
      input.removeEventListener('pointerdown', press);
    },
  };
};
