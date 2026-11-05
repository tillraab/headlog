import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface Toast {
  id: number;
  text: string;
  undo?: () => unknown;
}

export const toasts = $state<{ list: Toast[] }>({ list: [] });

let nextId = 1;

export function toast(text: string, undo?: () => unknown) {
  const id = nextId++;
  toasts.list = [...toasts.list.slice(-1), { id, text, undo }];
  setTimeout(() => dismiss(id), undo ? 5000 : 2500);
}

export function dismiss(id: number) {
  toasts.list = toasts.list.filter((t) => t.id !== id);
}

export function tap(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!Capacitor.isNativePlatform()) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  void Haptics.impact({ style: map[style] });
}

/** Open sheets, newest last. The Android back button closes the newest one. */
export const sheets = $state<{ stack: string[] }>({ stack: [] });

export function openSheet(id: string) {
  sheets.stack = [...sheets.stack.filter((s) => s !== id), id];
}

export function closeSheet(id: string) {
  sheets.stack = sheets.stack.filter((s) => s !== id);
}

/** Closes the newest sheet. Returns false when none was open. */
export function closeTopSheet(): boolean {
  if (!sheets.stack.length) return false;
  sheets.stack = sheets.stack.slice(0, -1);
  return true;
}

export type Theme = 'system' | 'light' | 'dark';

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14121c' : '#f7f6fb');
}

/** Value for an `<input type="datetime-local">`. */
export function toLocalInput(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}
