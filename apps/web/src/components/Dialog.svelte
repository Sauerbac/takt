<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  let {
    titleId,
    descriptionId,
    onclose,
    dismissOutside = false,
    initialFocus = 'button',
    width = 400,
    children,
  }: {
    titleId: string;
    descriptionId?: string;
    onclose: () => void;
    dismissOutside?: boolean;
    initialFocus?: string;
    width?: number;
    children: Snippet;
  } = $props();
  let element: HTMLDialogElement;
  onMount(() => {
    element.showModal();
    element.querySelector<HTMLElement>(initialFocus)?.focus();
  });
</script>

<dialog
  bind:this={element}
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  style:width={`${width}px`}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
  onkeydown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      ),
    ).filter((node) => node.tabIndex >= 0);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }}
  onclick={(event) => {
    if (!dismissOutside || event.target !== element) return;
    const bounds = element.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      onclose();
  }}
>
  {@render children()}
</dialog>

<style>
  dialog {
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 32px);
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--ink);
    background: var(--surface);
    box-shadow:
      0 20px 70px #182e472b,
      0 4px 16px #182e4712;
  }
  dialog::backdrop {
    background: #182e4730;
  }
</style>
