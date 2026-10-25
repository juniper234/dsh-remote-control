// A real child process running the production IPC protocol with a fake OS boundary.
// The explicit switch ensures normal node --test discovery never starts a helper.
if (process.argv.includes('--desktop-fixture')) {
  const { serveDesktopHelper } = await import('../lib/desktop-helper.mjs');
  const { createDesktopService } = await import('../lib/desktop-service.mjs');
  const native = {
    assertAvailable() {},
    monitors() { return [{ id: 'fake', name: 'Fixture', x: -100, y: 0, width: 200, height: 100, primary: true }]; },
    capture(_monitor, size) { return Buffer.alloc(size.width * size.height * 4); },
    sendInputs(events) { process.stdout.write(`${JSON.stringify(events)}\n`); return events.length; }, dispose() {},
  };
  if (process.argv.includes('--hang')) native.monitors = () => new Promise(() => {});
  serveDesktopHelper(createDesktopService(native));
}
