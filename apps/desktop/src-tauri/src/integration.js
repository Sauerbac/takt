// Runs only with the explicit executable acceptance flag; exercises embedded UI and IPC.
(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const waitFor = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      const value = predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Embedded frontend did not become ready');
  };
  try {
    const create = await waitFor(() =>
      Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent.trim() === 'New project',
      ),
    );
    if (!document.body.textContent.includes('Open .takt file'))
      throw new Error('Desktop Home did not render');
    create.click();
    const title = await waitFor(() =>
      document.querySelector('input[aria-label="Project title"]'),
    );
    if (title.value !== 'Untitled')
      throw new Error('Shared editor did not mount');
    const fileButton = await waitFor(() =>
      Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent.trim().startsWith('File '),
      ),
    );
    fileButton.click();
    await waitFor(() =>
      Array.from(document.querySelectorAll('[role="menuitem"]')).some(
        (button) => button.textContent.includes('Save As'),
      ),
    );
    const bridge = await waitFor(() => window.__TAKT_TEST__);
    title.value = 'Unsaved native edits';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    title.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await waitFor(() => document.querySelector('[aria-label="Modified"]'));
    await bridge.requestClose();
    const cancelClose = await waitFor(() =>
      Array.from(document.querySelectorAll('dialog button')).find(
        (button) => button.textContent.trim() === 'Cancel',
      ),
    );
    cancelClose.click();
    await waitFor(() => !document.querySelector('dialog[open]'));
    if (title.value !== 'Unsaved native edits')
      throw new Error('Native close cancellation lost edits');
    const opened = await bridge.adapter.open(bridge.path);
    if (opened.status !== 'success')
      throw new Error('Native open failed: ' + JSON.stringify(opened));
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
      },
    });
  } catch (error) {
    await invoke('integration_report', {
      report: { ok: false, error: String(error) },
    });
  }
})();
