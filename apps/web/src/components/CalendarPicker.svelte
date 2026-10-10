<script lang="ts">
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import { formatDate } from '../model/calendar';
  import {
    calendarDate,
    isoDate,
    monthGrid,
    moveDate,
    moveMonth,
  } from './calendar-grid';
  let {
    week,
    date,
    onchoose,
    onclose,
  }: {
    week: number;
    date: string;
    onchoose: (date: string) => void;
    onclose: () => void;
  } = $props();
  const id = $props.id();
  const now = new Date();
  const today = isoDate(
    calendarDate(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  // Each opening has an uncommitted draft. Showing today doesn't select a reference.
  // svelte-ignore state_referenced_locally
  let value = $state(date);
  // svelte-ignore state_referenced_locally
  let focused = $state(date || today);
  // svelte-ignore state_referenced_locally
  let month = $state(focused);
  let grid: HTMLTableElement;
  const days = $derived(monthGrid(month));
  const monthLabel = $derived(
    new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(month)),
  );
  function selectDate(day: string) {
    value = day;
    focused = day;
    month = day;
  }
  async function focusDate(day: string) {
    focused = day;
    month = day;
    await tick();
    grid.querySelector<HTMLButtonElement>(`[data-date="${day}"]`)?.focus();
  }
  function gridKey(event: KeyboardEvent, day: string) {
    event.stopPropagation();
    const weekday = (new Date(day).getUTCDay() + 6) % 7;
    const offset: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    const next =
      event.key === 'PageUp'
        ? moveMonth(day, -1)
        : event.key === 'PageDown'
          ? moveMonth(day, 1)
          : event.key in offset
            ? moveDate(day, offset[event.key])
            : null;
    if (next) {
      event.preventDefault();
      void focusDate(next);
    }
  }
</script>

<Dialog
  titleId={`${id}-title`}
  descriptionId={`${id}-description`}
  {onclose}
  dismissOutside
  initialFocus="[tabindex='0']"
  width={360}
>
  <div class="heading">
    <span class="calendar-icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24"
        ><rect x="4" y="5" width="16" height="16" rx="3" /><path
          d="M8 3v4m8-4v4M4 11h16m-11 4h2"
        /></svg
      ></span
    >
    <div>
      <h2 id={`${id}-title`}>Week {week + 1} starts on</h2>
      <p id={`${id}-description`}>Choose the first day of this week.</p>
    </div>
  </div>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      if (value) onchoose(value);
    }}
  >
    <div class="month-navigation">
      <span aria-live="polite">{monthLabel}</span>
      <button type="button" class="today" onclick={() => selectDate(today)}
        >Today</button
      >
      <button
        type="button"
        class="month-arrow"
        aria-label="Previous month"
        disabled={month.slice(0, 7) === '0001-01'}
        onclick={() => {
          const next = moveMonth(month, -1);
          month = next;
          focused = next;
        }}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="m10 4-4 4 4 4" /></svg
        ></button
      >
      <button
        type="button"
        class="month-arrow"
        aria-label="Next month"
        disabled={month.slice(0, 7) === '9999-12'}
        onclick={() => {
          const next = moveMonth(month, 1);
          month = next;
          focused = next;
        }}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="m6 4 4 4-4 4" /></svg
        ></button
      >
    </div>
    <table bind:this={grid} role="grid" aria-label={monthLabel}>
      <thead
        ><tr
          >{#each ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as day}<th
              scope="col">{day}</th
            >{/each}</tr
        ></thead
      >
      <tbody
        >{#each days as row}<tr
            >{#each row as day}<td aria-selected={!!day && value === day}>
                {#if day}<button
                    type="button"
                    data-date={day}
                    aria-label={formatDate(day)}
                    aria-current={day === today ? 'date' : undefined}
                    tabindex={focused === day ? 0 : -1}
                    class:outside={day.slice(0, 7) !== month.slice(0, 7)}
                    class:selected={value === day}
                    onclick={() => {
                      selectDate(day);
                      void focusDate(day);
                    }}
                    onkeydown={(event) => gridKey(event, day)}
                    >{Number(day.slice(8))}</button
                  >{/if}
              </td>{/each}</tr
          >{/each}</tbody
      >
    </table>
    <div class="actions">
      <Button onclick={onclose}>Cancel</Button><Button
        type="submit"
        variant="primary"
        disabled={!value}
        ><svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="m3.5 8 3 3 6-6" /></svg
        >Set date</Button
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
  .calendar-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
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
  .calendar-icon svg {
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
  }
  .month-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .month-navigation > span {
    margin-right: auto;
  }
  .month-arrow {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--ink);
    background: var(--surface);
    cursor: pointer;
  }
  .month-arrow:hover:enabled {
    background: var(--soft);
  }
  .month-arrow:disabled {
    opacity: 0.4;
    cursor: default;
  }
  table {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 3px;
    width: 100%;
  }
  th {
    height: 24px;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
  }
  td {
    padding: 0;
    height: 35px;
    text-align: center;
  }
  td button {
    width: 100%;
    height: 35px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    font-size: 12px;
    cursor: pointer;
    transition: background 150ms;
  }
  td button:hover {
    background: var(--soft);
  }
  td button.outside {
    color: #9ca7b4;
  }
  td button[aria-current='date'] {
    border-color: #e5ab81;
  }
  td button.selected,
  td button.selected:hover {
    background: var(--bar-fill);
    color: var(--bar-ink);
    font-weight: 600;
    box-shadow: 0 1px 2px #182e4712;
  }
  button:focus-visible {
    outline: 3px solid #f3b18480;
    outline-offset: 1px;
  }
  .today {
    padding: 6px 9px;
    border: 1px solid #f3b18455;
    border-radius: 6px;
    background: #f3b18418;
    color: #a16032;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .today:hover {
    background: #f3b18430;
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
