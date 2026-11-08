import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Theme } from './settings';

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

/** A short full-screen celebration, e.g. for reaching the hydration goal. */
export const celebration = $state<{ id: number; title: string; text: string }>({ id: 0, title: '', text: '' });

export function celebrate(title: string, text: string) {
  celebration.id++;
  celebration.title = title;
  celebration.text = text;
  tap('heavy');
}

export function dismiss(id: number) {
  toasts.list = toasts.list.filter((t) => t.id !== id);
}

export function tap(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!Capacitor.isNativePlatform()) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  void Haptics.impact({ style: map[style] });
}

/** Every sheet of the app, by the id it opens with. */
export type SheetId = 'editor' | 'settings' | 'medList' | 'drinkList' | 'versions' | 'report' | 'day';

/** Open sheets, newest last. The Android back button closes the newest one. */
export const sheets = $state<{ stack: SheetId[] }>({ stack: [] });

export function openSheet(id: SheetId) {
  sheets.stack = [...sheets.stack.filter((s) => s !== id), id];
}

export function closeSheet(id: SheetId) {
  sheets.stack = sheets.stack.filter((s) => s !== id);
}

export function closeAllSheets() {
  sheets.stack = [];
  closeInfo();
}

/** The explanation an info button opened, shown above every sheet until it is closed. */
export const info = $state<{ open: { title: string; text: string[]; sources: readonly string[] } | null }>({ open: null });

export function showInfo(title: string, text: string | string[], sources: readonly string[] = []) {
  info.open = { title, text: typeof text === 'string' ? [text] : text, sources };
}

export function closeInfo() {
  info.open = null;
}

/** Closes an open explanation, else the newest sheet. Returns false when neither was open. */
export function closeTopSheet(): boolean {
  if (info.open) {
    closeInfo();
    return true;
  }
  if (!sheets.stack.length) return false;
  sheets.stack = sheets.stack.slice(0, -1);
  return true;
}

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

/** Time from an `<input type="datetime-local">`, or null when the field is empty or invalid. */
export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}
