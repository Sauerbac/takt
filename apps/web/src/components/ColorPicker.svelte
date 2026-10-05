<script lang="ts">
  import { tick } from 'svelte';
  import type { Color } from '../model/document';
  import { palette, colorRows } from '../model/colors';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  let {
    color,
    name,
    onchoose,
    onclose,
  }: {
    color: Color;
    name: string;
    onchoose: (color: Color) => void;
    onclose: () => void;
  } = $props();
  const id = $props.id();
  const colors = colorRows.flat();
  // svelte-ignore state_referenced_locally
  let value = $state(color);
  let group: HTMLDivElement;
  async function navigate(event: KeyboardEvent, current: Color) {
    const index = colors.indexOf(current);
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -6,
      ArrowDown: 6,
    };
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? colors.length - 1
          : event.key in offsets
            ? (index + offsets[event.key] + colors.length) % colors.length
            : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    value = colors[next];
    await tick();
    group.querySelector<HTMLButtonElement>(`[data-color="${value}"]`)?.focus();
  }
</script>

<Dialog
  titleId={`${id}-title`}
  descriptionId={`${id}-description`}
  {onclose}
  dismissOutside
  initialFocus="[aria-checked='true']"
  width={360}
>
  <div class="heading">
    <span class="color-icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24"
        ><path
          d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.8 1.8 0 0 1 1.3-3.1H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"
        /><circle cx="7.5" cy="10" r=".7" /><circle
          cx="10"
          cy="6.8"
          r=".7"
        /><circle cx="14" cy="6.8" r=".7" /><circle
          cx="17"
          cy="10"
          r=".7"
        /></svg
      ></span
    >
    <div>
      <h2 id={`${id}-title`}>Choose color</h2>
      <p id={`${id}-description`}>Choose a shade for “{name}”.</p>
    </div>
  </div>
  <div
    class="swatches"
    bind:this={group}
    role="radiogroup"
    aria-label="Timeline colors"
  >
    {#each colors as shade}
      <button
        type="button"
        role="radio"
        aria-label={palette[shade].name}
        aria-checked={value === shade}
        tabindex={value === shade ? 0 : -1}
        data-color={shade}
        title={palette[shade].name}
        style:--fill={palette[shade].fill}
        style:--text={palette[shade].ink}
        onclick={() => (value = shade)}
        onkeydown={(event) => void navigate(event, shade)}
      >
        {#if value === shade}<svg viewBox="0 0 16 16" aria-hidden="true"
            ><path d="m4 8 2.5 2.5L12 5" /></svg
          >{/if}
      </button>
    {/each}
  </div>
  <div
    class="preview"
    style:--fill={palette[value].fill}
    style:--text={palette[value].ink}
  >
    <span class="preview-bar">Preview</span><span aria-live="polite"
      >{palette[value].name}</span
    >
  </div>
  <div class="actions">
    <Button onclick={onclose}>Cancel</Button><Button
      variant="primary"
      onclick={() => onchoose(value)}>Apply color</Button
    >
  </div>
</Dialog>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .color-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border: 1px solid #f3b18455;
    border-radius: 10px;
    background: #f3b18426;
    color: #ad6b3e;
  }
  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  h2 {
    font-size: 16px;
    letter-spacing: -0.3px;
    margin: 0 0 5px;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }
  .swatches button {
    display: grid;
    place-items: center;
    height: 38px;
    padding: 0;
    border: 1px solid #182e4714;
    border-radius: 6px;
    color: var(--text);
    background: var(--fill);
    cursor: pointer;
  }
  .swatches button:hover {
    box-shadow: inset 0 0 0 1px var(--text);
  }
  .swatches button[aria-checked='true'] {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  .swatches button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .swatches svg {
    width: 18px;
    height: 18px;
    stroke-width: 2;
  }
  .preview {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 24px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--section-bg);
    font-size: 12px;
    color: var(--muted);
  }
  .preview-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 104px;
    height: 28px;
    border-radius: var(--bar-radius);
    background: var(--fill);
    color: var(--text);
    font-weight: 600;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
</style>
