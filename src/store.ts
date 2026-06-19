import { create } from 'zustand';
import type { Role } from '@shared/types';

export type ToastKind = 'ok' | 'info' | 'warn' | 'block';
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  code?: string;
}

interface AppState {
  role: Role;
  setRole: (r: Role) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: 'station',
  setRole: (r) => set({ role: r }),
  toasts: [],
  pushToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const ROLE_META: Record<Role, { label: string; short: string; accent: string }> = {
  station: { label: '充装站', short: '充装', accent: 'text-safety-400' },
  delivery: { label: '配送员', short: '配送', accent: 'text-ok-400' },
  supervisor: { label: '监管人员', short: '监管', accent: 'text-recheck-400' },
};
