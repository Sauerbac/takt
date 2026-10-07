<script lang="ts">
  import type { Color } from '../model/document';
  import { colorAppearance, hueGradient } from '../model/colors';
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
  // Each opening seeds a draft; moving the slider never changes the chart.
  // svelte-ignore state_referenced_locally
  let value = $state(color);
  const appearance = $derived(colorAppearance(value));
  function navigate(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onchoose(value);
      return;
    }
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -10,
      PageUp: 10,
    };
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 359.9
          : event.key in offsets
            ? value + offsets[event.key]
            : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    value = Math.round(Math.max(0, Math.min(359.9, next)) * 10) / 10;
  }
</script>

<Dialog
  titleId={`${id}-title`}
  descriptionId={`${id}-description`}
  {onclose}
  dismissOutside
  initialFocus="input[type='range']"
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
      <p id={`${id}-description`}>Choose a color for “{name}”.</p>
    </div>
  </div>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      onchoose(value);
    }}
  >
    <label for={`${id}-hue`}>Color</label>
    <input
      id={`${id}-hue`}
      type="range"
      min="0"
      max="359.9"
      step="0.1"
      aria-label="Hue"
      aria-valuetext={`Hue ${value} degrees`}
      bind:value
      style:--hue-gradient={hueGradient}
      style:--selected-fill={appearance.fill}
      onkeydown={navigate}
    />
    <div
      class="preview"
      aria-label="Color preview"
      style:--fill={appearance.fill}
      style:--text={appearance.ink}
    >
      <span class="preview-label">Preview</span>
      <div class="preview-lane">
        <span class="preview-bar">{name}</span><span
          class="preview-milestone"
          aria-hidden="true"
        ></span>
      </div>
    </div>
    <div class="actions">
      <Button onclick={onclose}>Cancel</Button><Button
        type="submit"
        variant="primary"
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="m3.5 8 3 3 6-6" /></svg
        >Apply color</Button
      >
    </div>
  </form>
</Dialog>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
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
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .color-icon svg {
    width: 22px;
    height: 22px;
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
  label {
    display: block;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  input {
    display: block;
    appearance: none;
    width: 100%;
    height: 28px;
    margin: 0;
    border-radius: 7px;
    background: var(--hue-gradient);
    cursor: pointer;
  }
  input::-webkit-slider-runnable-track {
    height: 28px;
    border-radius: 7px;
  }
  input::-moz-range-track {
    height: 28px;
    border-radius: 7px;
    background: transparent;
  }
  input::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 34px;
    margin-top: -3px;
    border: 3px solid var(--surface);
    border-radius: 6px;
    background: var(--selected-fill);
    box-shadow:
      0 0 0 1px #182e4755,
      0 2px 5px #182e4733;
  }
  input::-moz-range-thumb {
    box-sizing: border-box;
    width: 18px;
    height: 34px;
    border: 3px solid var(--surface);
    border-radius: 6px;
    background: var(--selected-fill);
    box-shadow:
      0 0 0 1px #182e4755,
      0 2px 5px #182e4733;
  }
  input:focus-visible {
    outline: 3px solid #f3b18480;
    outline-offset: 5px;
  }
  .preview {
    margin-top: 24px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--section-bg);
  }
  .preview-label {
    display: block;
    color: var(--muted);
    font-size: 11px;
    margin-bottom: 10px;
  }
  .preview-lane {
    display: flex;
    align-items: center;
    gap: 22px;
    min-height: 38px;
    background: repeating-linear-gradient(
      to right,
      transparent 0 43px,
      var(--line) 43px 44px
    );
  }
  .preview-bar {
    display: block;
    box-sizing: border-box;
    width: 74%;
    height: 28px;
    padding: 6px 12px;
    border-radius: var(--bar-radius);
    background: var(--fill);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .preview-milestone {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 1px;
    background: var(--fill);
    transform: rotate(45deg);
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
