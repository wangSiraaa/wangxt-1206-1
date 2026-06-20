import { useEffect } from 'react';
import { type ReactNode } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Lock,
  Unlock,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, type ToastKind } from '../store';
import type { FillingStatus, InspectionResult, BlockCode, LockType } from '@shared/types';
import { cn } from '../lib/utils';

const BLOCK_CODE_LABEL: Record<BlockCode, string> = {
  CYLINDER_OVERDUE: '超期未检',
  WEIGHT_OUT_OF_TOLERANCE: '重量超差',
  RECORD_LOCKED_DELIVERED: '记录锁定',
  CYLINDER_LOCKED: '钢瓶锁定',
  RECHECK_EXCEEDED: '复称超限',
};

const LOCK_TYPE_LABEL: Record<LockType, string> = {
  WEIGHT: '重量异常',
  OVERDUE: '超期未检',
  MANUAL: '手动锁定',
};

export function BlockCodeBadge({ code }: { code: BlockCode }) {
  const isHard = code === 'CYLINDER_OVERDUE' || code === 'RECORD_LOCKED_DELIVERED' || code === 'CYLINDER_LOCKED' || code === 'RECHECK_EXCEEDED';
  return (
    <span
      className={cn(
        'chip',
        isHard
          ? 'border-hazard-600/50 bg-hazard-500/10 text-hazard-400'
          : 'border-recheck-500/50 bg-recheck-500/10 text-recheck-400',
      )}
    >
      {code}
      <span className="opacity-60">·</span>
      {BLOCK_CODE_LABEL[code]}
    </span>
  );
}

export function LockTypeBadge({ type }: { type: LockType }) {
  return (
    <span className="chip border-hazard-600/50 bg-hazard-500/10 text-hazard-400">
      <Lock className="w-3 h-3 mr-1" />
      {LOCK_TYPE_LABEL[type]}
    </span>
  );
}

export function LockBanner({ reason, lockedAt, onUnlock }: { reason: string | null; lockedAt: string | null; onUnlock?: () => void }) {
  return (
    <div className="rounded-lg border border-hazard-600/60 bg-hazard-500/10 px-4 py-3 scanline">
      <div className="flex items-start gap-3">
        <Lock className="w-5 h-5 text-hazard-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-hazard-300 tracking-wide">
              钢瓶已锁定
            </span>
            {lockedAt && (
              <span className="font-mono text-[10px] text-ink-400">
                {new Date(lockedAt).toLocaleString('zh-CN', { hour12: false })}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-100 mt-0.5">{reason ?? '未知原因'}</p>
          {onUnlock && (
            <button
              onClick={onUnlock}
              className="mt-2 text-xs font-mono text-hazard-400 hover:text-hazard-300 flex items-center gap-1"
            >
              <Unlock className="w-3 h-3" /> 申请解锁
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn('panel p-5', hover && 'panel-hover', className)}>{children}</div>;
}

export function SectionTitle({
  icon: Icon,
  title,
  hint,
  right,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="w-5 h-5 text-safety-400 shrink-0" />}
        <h2 className="text-base font-semibold text-ink-100 truncate">{title}</h2>
        {hint && <span className="label-tag shrink-0">{hint}</span>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'warn' | 'danger' | 'ok';
  onClick?: () => void;
}) {
  const toneCls = {
    default: 'text-ink-100',
    warn: 'text-safety-400',
    danger: 'text-hazard-400',
    ok: 'text-ok-400',
  }[tone];
  return (
    <Panel className={cn('relative overflow-hidden', onClick && 'cursor-pointer hover:border-ink-500 transition-colors')} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <div className="label-tag mb-2">{label}</div>
          <div className="flex items-baseline gap-1">
            <span className={cn('stat-num text-4xl leading-none', toneCls)}>{value}</span>
            {unit && <span className="text-ink-400 text-sm font-mono">{unit}</span>}
          </div>
        </div>
        {Icon && <Icon className={cn('w-6 h-6', toneCls, 'opacity-70')} />}
      </div>
    </Panel>
  );
}

export function FillingStatusBadge({ status }: { status: FillingStatus }) {
  const map: Record<FillingStatus, { label: string; cls: string }> = {
    normal: { label: '正常', cls: 'border-ok-600/50 bg-ok-500/10 text-ok-400' },
    recheck: { label: '复称中', cls: 'border-recheck-500/50 bg-recheck-500/10 text-recheck-400' },
    blocked_overdue: {
      label: '超期阻断',
      cls: 'border-hazard-600/50 bg-hazard-500/10 text-hazard-400',
    },
    blocked_weight: {
      label: '复称锁定',
      cls: 'border-hazard-600/50 bg-hazard-500/10 text-hazard-400',
    },
  };
  const m = map[status];
  return <span className={cn('chip', m.cls)}>{m.label}</span>;
}

export function InspectionResultBadge({ result }: { result: InspectionResult }) {
  const map: Record<InspectionResult, { label: string; cls: string }> = {
    pass: { label: '合格', cls: 'border-ok-600/50 bg-ok-500/10 text-ok-400' },
    abnormal: { label: '异常', cls: 'border-hazard-600/50 bg-hazard-500/10 text-hazard-400' },
    seized: { label: '查扣', cls: 'border-hazard-600/70 bg-hazard-500/20 text-hazard-300' },
  };
  const m = map[result];
  return <span className={cn('chip', m.cls)}>{m.label}</span>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label-tag block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-ink-400 font-mono">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block w-4 h-4 border-2 border-ink-500 border-t-safety-400 rounded-full animate-spin',
        className,
      )}
    />
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-ink-400">
      <div className="w-px h-8 bg-ink-700 mb-3" />
      <span className="font-mono text-sm">{text}</span>
    </div>
  );
}

export function BlockBanner({
  code,
  message,
}: {
  code: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-hazard-600/60 bg-hazard-500/10 px-4 py-3 scanline">
      <div className="flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-hazard-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-hazard-300 tracking-wide">
              阻断 · {code}
            </span>
          </div>
          <p className="text-sm text-ink-100 mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function InfoBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800/50 px-4 py-3">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-ink-400 shrink-0 mt-0.5" />
        <p className="text-sm text-ink-200">{message}</p>
      </div>
    </div>
  );
}

const TOAST_META: Record<ToastKind, { icon: LucideIcon; cls: string }> = {
  ok: { icon: CheckCircle2, cls: 'border-ok-600/50 bg-ok-500/10 text-ok-400' },
  info: { icon: Info, cls: 'border-ink-600 bg-ink-800/80 text-ink-200' },
  warn: { icon: AlertTriangle, cls: 'border-safety-600/50 bg-safety-500/10 text-safety-400' },
  block: { icon: AlertOctagon, cls: 'border-hazard-600/60 bg-hazard-500/15 text-hazard-400' },
};

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const remove = useAppStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => remove(t.id), t.kind === 'block' ? 6000 : 3500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)]">
      {toasts.map((t) => {
        const m = TOAST_META[t.kind];
        const Icon = m.icon;
        return (
          <div
            key={t.id}
            className={cn('panel px-3.5 py-3 flex items-start gap-2.5 animate-riseIn', m.cls)}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{t.title}</span>
                {t.code && (
                  <span className="font-mono text-[10px] opacity-80 px-1.5 rounded bg-black/30">
                    {t.code}
                  </span>
                )}
              </div>
              {t.message && <p className="text-xs opacity-90 mt-0.5 break-words">{t.message}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
