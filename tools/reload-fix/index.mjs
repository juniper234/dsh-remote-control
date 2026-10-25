// Local compatibility fix for DSH 0.2.1-rc.2. Do not modify the installed ASAR.
export const name = 'file-upload-reload-fix';
export const inject = ['fileUploads'];

export function apply(ctx) {
  const traced = ctx.get('fileUploads');
  const uploads = traced[Symbol.for('cordis.original')] ?? traced;
  const descriptor = Object.getOwnPropertyDescriptor(uploads, 'registerAgentResolver');
  const register = uploads.registerAgentResolver;

  // Cordis wraps function-valued fields on traced service reads. The stock
  // disposer compares uploads.agentResolver with its original callback; using
  // the underlying instance makes that identity check work again. Keep the
  // stock method, including its duplicate-registration check and disposer.
  const registerOnOwner = (resolve) => Reflect.apply(register, uploads, [resolve]);
  ctx.effect(() => {
    Object.defineProperty(uploads, 'registerAgentResolver', {
      value: registerOnOwner,
      configurable: true,
      writable: true,
    });
    return () => {
      if (Object.getOwnPropertyDescriptor(uploads, 'registerAgentResolver')?.value !== registerOnOwner) return;
      if (descriptor) Object.defineProperty(uploads, 'registerAgentResolver', descriptor);
      else delete uploads.registerAgentResolver;
    };
  }, 'file-upload resolver identity compatibility');

  // SessionController explicitly depends on this marker in the profile patch,
  // so registration waits for the fix and follows its dependency lifecycle.
  ctx.provide('fileUploadResolverReloadSafe', Object.freeze({ version: 1 }));
}
