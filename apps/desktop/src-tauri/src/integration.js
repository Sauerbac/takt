// Runs only with the explicit executable acceptance flag; exercises embedded UI and IPC.
(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  let stage = 'Home startup';
  const waitFor = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      const value = predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Embedded frontend did not become ready during ${stage}`);
  };
  try {
    await waitFor(() => document.querySelector('button.new-project'));
    if (!document.body.textContent.includes('Open .takt file'))
      throw new Error('Desktop Home did not render');
    const bridge = await waitFor(() => window.__TAKT_TEST__);
    stage = 'Home drag-enter';
    await bridge.emitFileDrop('enter', [bridge.path]);
    await waitFor(() => document.querySelector('.drop-zone.drag-active'));
    await bridge.emitFileDrop('leave', []);
    stage = 'Home drag-leave';
    await waitFor(() => !document.querySelector('.drop-zone.drag-active'));
    await bridge.emitFileDrop('drop', [bridge.path]);
    stage = 'Home file open';
    await waitFor(
      () =>
        document.querySelector('input[aria-label="Project title"]')?.value ===
        'Autumn α 🌻',
    );
    document.querySelector('button[aria-label="Home"]').click();
    stage = 'Return Home';
    await waitFor(() => document.querySelector('.drop-zone'));
    document.querySelector('button.new-project').click();
    stage = 'Create project';
    const title = await waitFor(() =>
      document.querySelector('input[aria-label="Project title"]'),
    );
    if (title.value !== 'Untitled')
      throw new Error('Shared editor did not mount');
    const fileButton = await waitFor(() =>
      document.querySelector('button[aria-label="File"]'),
    );
    fileButton.click();
    stage = 'Native File menu';
    await waitFor(() =>
      Array.from(document.querySelectorAll('[role="menuitem"]')).some(
        (button) => button.textContent.includes('Save As'),
      ),
    );
    title.value = 'Unsaved native edits';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    title.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await waitFor(() => document.querySelector('[aria-label="Modified"]'));
    await bridge.requestClose();
    stage = 'Native close guard';
    const cancelClose = await waitFor(() =>
      Array.from(document.querySelectorAll('dialog button')).find(
        (button) => button.textContent.trim() === 'Cancel',
      ),
    );
    cancelClose.click();
    await waitFor(() => !document.querySelector('dialog[open]'));
    if (title.value !== 'Unsaved native edits')
      throw new Error('Native close cancellation lost edits');
    await bridge.emitFileDrop('enter', [bridge.path]);
    stage = 'Editor drag-enter';
    await waitFor(() => document.querySelector('.drop-overlay'));
    await bridge.emitFileDrop('drop', [bridge.path]);
    stage = 'Editor drop guard';
    const cancelDrop = await waitFor(() =>
      Array.from(document.querySelectorAll('dialog[open] button')).find(
        (button) => button.textContent.trim() === 'Cancel',
      ),
    );
    cancelDrop.click();
    await waitFor(() => !document.querySelector('dialog[open]'));
    if (title.value !== 'Unsaved native edits')
      throw new Error('Native drop cancellation lost edits');
    await bridge.emitFileDrop('drop', [bridge.path]);
    stage = 'Editor replacement';
    const discardDrop = await waitFor(() =>
      Array.from(document.querySelectorAll('dialog[open] button')).find(
        (button) => button.textContent.trim() === 'Discard changes',
      ),
    );
    discardDrop.click();
    const droppedTitle = await waitFor(() => {
      const input = document.querySelector('input[aria-label="Project title"]');
      return input?.value === 'Autumn α 🌻' ? input : null;
    });
    droppedTitle.value = 'Dropped native project';
    droppedTitle.dispatchEvent(new Event('input', { bubbles: true }));
    droppedTitle.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    document.querySelector('button[aria-label="File"]').click();
    stage = 'Save dropped project';
    const saveDrop = await waitFor(() =>
      Array.from(document.querySelectorAll('[role="menuitem"]')).find(
        (button) =>
          button.textContent.trim().startsWith('Save') &&
          !button.textContent.trim().startsWith('Save As'),
      ),
    );
    saveDrop.click();
    await waitFor(() => !document.querySelector('[aria-label="Modified"]'));
    const opened = await bridge.adapter.open(bridge.path);
    if (opened.status !== 'success')
      throw new Error('Native open failed: ' + JSON.stringify(opened));
    if (opened.value.snapshot.title !== 'Dropped native project')
      throw new Error('Dropped project did not save to its native path');
    const snapshot = opened.value.snapshot;
    if (
      !snapshot.document.bars.some((bar) => bar.start < 0) ||
      !snapshot.document.milestones.length ||
      snapshot.view.zoom === 1
    )
      throw new Error('Mixed web fixture lost content or view');
    const edited = { ...snapshot, title: 'Native round trip' };
    const saved = await bridge.adapter.save(edited, opened.value.file);
    if (saved.status !== 'success')
      throw new Error('Native save failed: ' + JSON.stringify(saved));
    const reopened = await bridge.adapter.open(bridge.path);
    if (
      reopened.status !== 'success' ||
      bridge.encodeProject(reopened.value.snapshot) !==
        bridge.encodeProject(edited)
    )
      throw new Error('Codec/native bytes did not round-trip');
    const conflict = await bridge.adapter.save(
      { ...edited, title: 'Stale work' },
      opened.value.file,
    );
    if (conflict.status !== 'conflict')
      throw new Error('External revision protection failed');
    const record = {
      version: 1,
      baseline: '',
      id: 'integration-recovery',
      updatedAt: new Date().toISOString(),
      snapshot: edited,
      file: saved.value,
    };
    await bridge.adapter.writeRecovery(record);
    if (
      !(await bridge.adapter.listRecovery()).some(
        (draft) => draft.id === record.id,
      )
    )
      throw new Error('Recovery IPC failed');
    await bridge.adapter.removeRecovery(record.id);
    if (
      !(await bridge.adapter.listRecents()).some(
        (recent) => recent.path === bridge.path,
      )
    )
      throw new Error('Recents IPC failed');
    await bridge.adapter.removeRecent(bridge.path);
    const preserved = await bridge.adapter.open(bridge.path);
    if (preserved.status !== 'success')
      throw new Error('Removing recent deleted project');
    await invoke('integration_report', {
      report: {
        ok: true,
        home: true,
        sharedEditor: true,
        nativeSaveMenu: true,
        webview2: true,
        fileRoundTrip: true,
        mixedWebCodec: true,
        externalRevision: true,
        recovery: true,
        recents: true,
        nativeCloseCancelled: true,
        nativeFileDrop: true,
      },
    });
  } catch (error) {
    await invoke('integration_report', {
      report: { ok: false, error: String(error) },
    });
  }
})();
