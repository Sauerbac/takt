// Three compact-bar interaction proposals on the ShortBars fixture, selected
// by ?variant=A|B|C. This module is excluded from the production entry.
export function shortBarsPrototype(variant: string) {
  const names = [
    'A · Move directly',
    'B · Click to zoom',
    'C · Select for detail',
  ];
  const descriptions = [
    'Small bars omit labels. Below 32 px, the whole bar moves; zoom in to resize. Hover shows the full name and dates.',
    'Small bars omit labels. Below 32 px, click to zoom around the bar, then move or resize at a readable scale.',
    'Small bars omit labels. Below 32 px, select to read the full name and dates in a detail strip; zoom in to edit.',
  ];
  let index = Math.max(0, ['A', 'B', 'C'].indexOf(variant));
  const style = document.createElement('style');
  style.textContent = `
    .bar[data-prototype-small="true"]:not(.editing) span { visibility:hidden; }
    body[data-short-bars-variant="A"] .bar[data-prototype-tiny="true"] .handle,
    body[data-short-bars-variant="B"] .bar[data-prototype-tiny="true"] .handle,
    body[data-short-bars-variant="C"] .bar[data-prototype-tiny="true"] .handle { visibility:hidden; pointer-events:none; }
    body[data-short-bars-variant="B"] .bar[data-prototype-tiny="true"] { cursor:zoom-in; }
    body[data-short-bars-variant="C"] .bar[data-prototype-tiny="true"] { cursor:pointer; }
    .prototype-switcher { position:fixed; z-index:50; bottom:12px; left:50%; transform:translateX(-50%); max-width:730px; width:calc(100% - 80px); padding:12px 16px; border-radius:12px; background:#182e47; color:white; box-shadow:0 4px 20px #182e4730; font-size:12px; }
    .prototype-switcher nav { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .prototype-switcher button { border:0; padding:5px 12px; border-radius:5px; cursor:pointer; color:#182e47; background:#f0f3f7; }
    .prototype-switcher button[aria-pressed="true"] { background:#f3b184; }
    .prototype-actions { display:flex; gap:7px; margin-top:10px; flex-wrap:wrap; }
    .bar[data-prototype-example="true"] { outline:2px solid #b35d35; outline-offset:2px; }
    .prototype-switcher p { margin:8px 0 0; line-height:1.4; color:#dce3eb; }
    .prototype-detail { position:fixed; z-index:49; bottom:158px; left:50%; transform:translateX(-50%); background:white; border:1px solid #dce3eb; border-radius:8px; padding:15px 20px; min-width:380px; font-size:13px; box-shadow:0 4px 20px #182e4720; }
    .prototype-detail button { display:block; margin-top:10px; padding:6px 12px; }
  `;
  document.head.append(style);
  const switcher = document.createElement('aside');
  switcher.className = 'prototype-switcher';
  switcher.innerHTML =
    '<nav><button aria-label="Previous proposal">←</button><strong></strong><button aria-label="Next proposal">→</button></nav><p></p><div class="prototype-actions"><button data-variant="A">A · Move</button><button data-variant="B">B · Zoom</button><button data-variant="C">C · Detail</button><button data-overview>Overview 12.5%</button><button data-example>Try Workshop</button></div>';
  document.body.append(switcher);
  const detail = document.createElement('aside');
  detail.className = 'prototype-detail';
  detail.hidden = true;
  document.body.append(detail);
  function update() {
    document.body.dataset.shortBarsVariant = ['A', 'B', 'C'][index];
    switcher.querySelector('strong')!.textContent =
      `PROTOTYPE · ${names[index]}`;
    switcher.querySelector('p')!.textContent = descriptions[index];
    detail.hidden = true;
    switcher
      .querySelectorAll<HTMLButtonElement>('[data-variant]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.variant === ['A', 'B', 'C'][index]),
        ),
      );
    document
      .querySelectorAll<HTMLElement>('[data-prototype-example]')
      .forEach((bar) => delete bar.dataset.prototypeExample);
    const url = new URL(location.href);
    url.searchParams.set('variant', ['A', 'B', 'C'][index]);
    history.replaceState(null, '', url);
    requestAnimationFrame(zoomOverview);
  }
  function cycle(delta: number) {
    index = (index + delta + 3) % 3;
    update();
  }
  switcher.querySelectorAll('button')[0].onclick = () => cycle(-1);
  switcher.querySelectorAll('button')[1].onclick = () => cycle(1);
  switcher
    .querySelectorAll<HTMLButtonElement>('[data-variant]')
    .forEach((button) => {
      button.onclick = () => {
        index = ['A', 'B', 'C'].indexOf(button.dataset.variant!);
        update();
      };
    });
  switcher.querySelector<HTMLButtonElement>('[data-overview]')!.onclick =
    zoomOverview;
  switcher.querySelector<HTMLButtonElement>('[data-example]')!.onclick = () => {
    const bar = document.querySelector<HTMLElement>(
      '[data-testid="bar-short-2"]',
    )!;
    bar.dataset.prototypeExample = 'true';
    if (index === 1) zoomToBar(bar);
    else if (index === 2) showDetail(bar);
    else
      switcher.querySelector('p')!.textContent =
        'Workshop is outlined in the first row. Drag that bar horizontally to move it; zoom in to resize. This proposal keeps direct movement at overview scale.';
  };
  document.addEventListener('keydown', (event) => {
    if ((event.target as Element).closest('input, textarea, [contenteditable]'))
      return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      cycle(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  function zoomToBar(bar: HTMLElement) {
    const box = bar.getBoundingClientRect();
    bar.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        isPrimary: true,
        pointerId: 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
    detail.hidden = true;
  }
  function zoomOverview() {
    const viewport = document.querySelector<HTMLElement>('.viewport')!;
    const bounds = viewport.getBoundingClientRect();
    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: 5000,
        clientX: (bounds.left + 218 + bounds.right) / 2,
        clientY: bounds.top + 100,
        bubbles: true,
        cancelable: true,
      }),
    );
    detail.hidden = true;
  }
  function showDetail(bar: HTMLElement) {
    detail.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = bar.title;
    const zoom = document.createElement('button');
    zoom.textContent = 'Zoom to edit';
    zoom.onclick = () => zoomToBar(bar);
    detail.append(name, zoom);
    detail.hidden = false;
  }
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isTrusted) return;
      const bar = (event.target as Element).closest<HTMLElement>(
        '.bar[data-prototype-tiny="true"]:not(.editing)',
      );
      if (!bar || event.button !== 0) return;
      // B now uses the production animation. A and C retain their contrasting
      // prototype interactions for the design comparison.
      if (index === 1) return;
      if (index === 0) {
        bar.classList.remove('compact');
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      showDetail(bar);
    },
    true,
  );
  document.addEventListener('pointerup', () =>
    document
      .querySelectorAll<HTMLElement>('.bar')
      .forEach((bar) =>
        bar.classList.toggle('compact', bar.dataset.prototypeTiny === 'true'),
      ),
  );
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const bar = entry.target as HTMLElement;
      bar.dataset.prototypeSmall = String(
        entry.borderBoxSize[0].inlineSize < 56,
      );
      bar.dataset.prototypeTiny = String(
        entry.borderBoxSize[0].inlineSize < 32,
      );
    }
  });
  document.querySelectorAll('.bar').forEach((bar) => observer.observe(bar));
  update();
}
