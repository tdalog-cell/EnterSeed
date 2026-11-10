import { useEffect } from 'react';

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const navigation = (event: Event) => event.preventDefault();
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('enterseed:before-navigate', navigation);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('enterseed:before-navigate', navigation);
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty]);
}
