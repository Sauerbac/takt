<script lang="ts">
  import { tick } from 'svelte';
  let {
    label,
    value,
    options,
    disabled = false,
    onchange,
  }: {
    label: string;
    value: number;
    options: { value: number; label: string }[];
    disabled?: boolean;
    onchange: (value: number) => void;
  } = $props();
  const id = $props.id();
  let trigger: HTMLButtonElement;
  let menu: HTMLDivElement;
  let open = $state(false);
  let active = $state(0);
  let left = $state(0);
  let top = $state(0);
  const selected = $derived(
    options.findIndex((option) => option.value === value),
  );
  const text = $derived(
    options[selected]?.label ?? `${Math.round(value * 100)}%`,
  );
  async function focusOption(index: number) {
    active = index;
    await tick();
    menu.querySelectorAll<HTMLButtonElement>('[role=option]')[active]?.focus();
  }
  function close(restore = true) {
    menu.hidePopover();
    open = false;
    if (restore) trigger.focus({ preventScroll: true });
  }
  function show(index = Math.max(0, selected)) {
    const bounds = trigger.getBoundingClientRect();
    left = Math.min(bounds.left, window.innerWidth - 144);
    top = bounds.bottom + 6;
    menu.showPopover();
    // Native toggle notifications are queued; keyboard input can arrive first.
    open = true;
    void focusOption(index);
  }
  function keydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Tab') {
      close(false);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
              options.length;
      if (open) void focusOption(index);
      else
        show(
          event.key === 'ArrowUp' ? options.length - 1 : Math.max(0, selected),
        );
    }
  }
  $effect(() => {
    if (disabled && open) close(false);
  });
</script>

<button
  bind:this={trigger}
  type="button"
  role="combobox"
  aria-label={label}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={id}
  {disabled}
  class:open
  onclick={() => (open ? close() : show())}
  onkeydown={keydown}
>
  <span>{text}</span>
  <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"
    ><path d="m4 6 4 4 4-4" /></svg
  >
</button>
<div
  bind:this={menu}
  {id}
  popover="auto"
  role="listbox"
  tabindex="-1"
  aria-label={label}
  class="options"
  style:left={`${left}px`}
  style:top={`${top}px`}
  ontoggle={(event) => {
    open = event.newState === 'open';
  }}
  onkeydown={keydown}
>
  {#each options as option, index}
    <button
      type="button"
      role="option"
      aria-selected={option.value === value}
      tabindex={active === index ? 0 : -1}
      onclick={() => {
        onchange(option.value);
        close();
      }}
    >
      {option.label}<span aria-hidden="true"
        >{option.value === value ? '✓' : ''}</span
      >
    </button>
  {/each}
</div>

<style>
  button {
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  button[role='combobox'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    min-width: 82px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    box-shadow: 0 1px 2px #182e4708;
    transition:
      background 150ms,
      border-color 150ms;
  }
  button[role='combobox']:hover:enabled,
  .open {
    background: var(--soft);
    border-color: #b9c3ce;
  }
  button:focus-visible {
    outline: 3px solid #f3b18480;
    outline-offset: 2px;
  }
  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .chevron {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 150ms ease;
  }
  .open .chevron {
    transform: rotate(180deg);
  }
  .options {
    position: fixed;
    margin: 0;
    width: 136px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    box-shadow:
      0 8px 24px #182e471a,
      0 2px 6px #182e470a;
  }
  .options button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 9px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    text-align: left;
    font-weight: 500;
  }
  .options button:hover,
  .options button:focus-visible {
    background: var(--soft);
    outline: none;
  }
  .options button[aria-selected='true'] {
    background: #f3b18426;
  }
  .options span {
    color: #aa6536;
  }
</style>
