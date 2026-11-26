// Native builds deliberately do not persist bearer credentials to disk.
const mobile = window.location.origin === 'https://localhost' || import.meta.env.VITE_ANDROID_BUILD === 'true';
const memory = new Map<string, string>();
if (mobile) {
  localStorage.removeItem('kaamsetu_token');
  localStorage.removeItem('kaamsetu_user');
}
export const authStorage = {
  getItem(key: string): string | null { return mobile ? memory.get(key) ?? null : localStorage.getItem(key); },
  setItem(key: string, value: string): void { if (mobile) memory.set(key, value); else localStorage.setItem(key, value); },
  removeItem(key: string): void { if (mobile) memory.delete(key); else localStorage.removeItem(key); },
};
