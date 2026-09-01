declare global {
  interface Window {
    __primeUiLicense?: string;
  }
}

export function primeUiLicense(): string {
  return globalThis.window?.__primeUiLicense?.trim() ?? '';
}
