<script lang="ts">
  // The project title, shown as a raised field at rest so it reads as editable.
  let {
    value = $bindable(),
    label,
    hint,
    modified = false,
    oncommit,
    oncancel,
  }: {
    value: string;
    label: string;
    hint: string;
    modified?: boolean;
    oncommit: () => void;
    oncancel: () => void;
  } = $props();
</script>

<label class="title-field" title={hint}>
  <!-- The mark's column stays when it is hidden, so the title keeps its centre. -->
  <span class="mark"
    >{#if modified}<span
        class="modified"
        role="img"
        aria-label="Modified"
        title="Unsaved changes"
      ></span>{/if}</span
  >
  <input
    aria-label={label}
    size="1"
    bind:value
    onblur={oncommit}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        oncancel();
        event.currentTarget.blur();
      }
    }}
  /><svg viewBox="0 0 16 16" aria-hidden="true"
    ><path d="m10.7 2.3 3 3-8.6 8.6-3.6.6.6-3.6zM9.3 3.7l3 3" /></svg
  >
</label>

<style>
  .title-field {
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr) 14px;
    align-items: center;
    gap: 8px;
    width: 340px;
    max-width: 100%;
    /* The height of the header's buttons, so the row reads as one line. */
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
    box-shadow: var(--shadow-raised);
    cursor: text;
    transition:
      background 150ms,
      border-color 150ms;
  }
  .mark {
    display: grid;
    place-items: center;
  }
  .modified {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: center;
    text-overflow: ellipsis;
  }
  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Neutral states: the caret shows editing, and apricot stays with actions. */
  .title-field:hover {
    border-color: var(--line-strong);
    background: var(--soft);
  }
  .title-field:focus-within {
    border-color: var(--line-strong);
    background: var(--surface);
  }
</style>
