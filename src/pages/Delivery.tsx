import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Store, ClipboardCheck, Lock, AlertTriangle, Eye } from 'lucide-react';
import { Panel, SectionTitle, BlockBanner, LockBanner, FillingStatusBadge, InfoBanner, EmptyState, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store';
import type { Cylinder, FillingRecord } from '@shared/types';
import { cn } from '../lib/utils';

export default function Delivery() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [fillings, setFillings] = useState<FillingRecord[]>([]);
  const [cylinders, setCylinders] = useState<Cylinder[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [store, setStore] = useState('城东便民门店');
  const [courier, setCourier] = useState('张配送');
  const [submitting, setSubmitting] = useState(false);
  const [blockedFilling, setBlockedFilling] = useState<{ id: number; code: string; message: string } | null>(null);
  const [lockedCylinders, setLockedCylinders] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [f, c, locked] = await Promise.all([
      api.listFillings(),
      api.listCylinders(),
      api.listLockedCylinders().catch(() => []),
    ]);
    setFillings(f);
    setCylinders(c);
    setLockedCylinders(new Set(locked.map((l) => l.cylinder_code)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const undelivered = fillings.filter((f) => !f.delivered && f.status !== 'blocked_overdue' && f.status !== 'blocked_weight');
  const recent = fillings.filter((f) => f.delivered).slice(0, 8);

  const totalWeight = useMemo(
    () =>
      Array.from(selected).reduce((sum, id) => {
        const f = fillings.find((x) => x.id === id);
        return sum + (f?.filling_weight ?? 0);
      }, 0),
    [selected, fillings],
  );

  function toggle(id: number) {
    const f = fillings.find((x) => x.id === id);
    if (!f) return;

    if (lockedCylinders.has(f.cylinder_code)) {
      const cyl = cylinders.find((c) => c.cylinder_code === f.cylinder_code);
      pushToast({
        kind: 'block',
        title: '钢瓶已锁定',
        message: cyl?.lock_reason ?? '该钢瓶无法配送，请先联系管理人员解锁',
        code: 'CYLINDER_LOCKED',
      });
      return;
    }

    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setBlockedFilling(null);
  }

  async function confirm() {
    if (selected.size === 0) {
      pushToast({ kind: 'warn', title: '请选择充装记录' });
      return;
    }
    setSubmitting(true);
    setBlockedFilling(null);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        await api.deliver(id, { store, courier });
      }
      pushToast({ kind: 'ok', title: '配送已确认', message: `${selected.size} 瓶已发往 ${store}` });
      setSelected(new Set());
      refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        const match = e.message.match(/#(\d+)/);
        const fid = match ? Number(match[1]) : null;
        setBlockedFilling({ id: fid ?? -1, code: e.code ?? 'ERR', message: e.message });
        pushToast({ kind: 'block', title: '配送阻断', message: e.message, code: e.code });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const cylinderMap = useMemo(() => {
    const m = new Map<string, Cylinder>();
    cylinders.forEach((c) => m.set(c.cylinder_code, c));
    return m;
  }, [cylinders]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="stat-num text-3xl text-ink-100 tracking-wide">配送作业台</h1>
        <p className="text-sm text-ink-400 mt-1">选择待配送充装记录 · 确认流向后记录自动锁定 · 禁止修改 · 仅允许追加抽查结论</p>
      </div>

      {lockedCylinders.size > 0 && (
        <InfoBanner
          message={`当前有 ${lockedCylinders.size} 个钢瓶处于锁定状态，无法进行配送。请在监管中心查看并处理。`}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Panel>
            <SectionTitle icon={Truck} title="待配送充装记录" hint={`${undelivered.length} 条`} />
            {undelivered.length === 0 ? (
              <EmptyState text="暂无待配送记录" />
            ) : (
              <div className="space-y-2">
                {undelivered.map((f) => {
                  const cyl = cylinderMap.get(f.cylinder_code);
                  const isCylLocked = lockedCylinders.has(f.cylinder_code);
                  const isChecked = selected.has(f.id);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'rounded-lg border p-3.5 flex items-center gap-3 transition-all',
                        isCylLocked
                          ? 'border-hazard-600/30 bg-hazard-500/5 opacity-60 cursor-not-allowed'
                          : isChecked
                            ? 'border-safety-500/60 bg-safety-500/10 cursor-pointer'
                            : 'border-ink-700 bg-ink-900/40 hover:border-ink-500 cursor-pointer',
                      )}
                      onClick={() => toggle(f.id)}
                    >
                      <div className="flex-shrink-0">
                        {isCylLocked ? (
                          <Lock className="w-5 h-5 text-hazard-400" />
                        ) : (
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                              isChecked
                                ? 'border-safety-400 bg-safety-400'
                                : 'border-ink-500 hover:border-ink-400',
                            )}
                          >
                            {isChecked && <ClipboardCheck className="w-3.5 h-3.5 text-ink-950" />}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-ink-100">
                            {f.cylinder_code}
                          </span>
                          {isCylLocked && (
                            <span className="chip border-hazard-600/50 bg-hazard-500/10 text-hazard-400 text-[10px]">
                              <Lock className="w-3 h-3 inline mr-1" /> 钢瓶锁定
                            </span>
                          )}
                          {f.recheck_count > 0 && (
                            <span className="chip border-recheck-500/50 bg-recheck-500/10 text-recheck-400 text-[10px]">
                              复称 {f.recheck_count} 次
                            </span>
                          )}
                          <FillingStatusBadge status={f.status} />
                        </div>
                        <div className="font-mono text-xs text-ink-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>#{f.id} · {f.filling_weight} / {f.target_weight} kg</span>
                          {f.weight_diff !== null && f.weight_diff !== undefined && (
                            <span className={cn(
                              f.weight_diff > 0 ? 'text-safety-400' : f.weight_diff < 0 ? 'text-ok-400' : 'text-ink-400',
                            )}>
                              偏差 {f.weight_diff > 0 ? '+' : ''}{f.weight_diff}kg
                            </span>
                          )}
                        </div>
                        {isCylLocked && cyl && (
                          <div className="text-xs text-hazard-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {cyl.lock_reason}
                          </div>
                        )}
                      </div>
                      <div className="font-mono text-xs text-ink-500">
                        {new Date(f.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <SectionTitle icon={Store} title="配送信息" />
            <div className="space-y-3">
              <div>
                <span className="label-tag block mb-1.5">配送门店</span>
                <select className="input" value={store} onChange={(e) => setStore(e.target.value)}>
                  <option>城东便民门店</option>
                  <option>城西批发门市</option>
                  <option>城南直营店</option>
                  <option>城北服务中心</option>
                </select>
              </div>
              <div>
                <span className="label-tag block mb-1.5">配送员</span>
                <input className="input" value={courier} onChange={(e) => setCourier(e.target.value)} />
              </div>
              <div className="rounded-lg border border-ink-700 bg-ink-950/50 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-400">已选记录</span>
                  <span className="font-mono text-ink-100">{selected.size} 条</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-400">总重量</span>
                  <span className="font-mono text-ink-100">{totalWeight.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-400">流向</span>
                  <span className="font-mono text-ink-100 truncate ml-2 max-w-[180px]">{store}</span>
                </div>
              </div>
              {blockedFilling && (
                <BlockBanner code={blockedFilling.code} message={blockedFilling.message} />
              )}
              <InfoBanner
                message="配送确认后，原充装记录将被锁定，禁止修改。如需补充信息请在监管中心使用「抽查」功能追加结论。"
              />
              <button
                onClick={confirm}
                className="btn btn-primary w-full"
                disabled={submitting || selected.size === 0}
              >
                {submitting ? <Spinner /> : <Truck className="w-4 h-4" />}
                确认配送流向 ({selected.size})
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <SectionTitle icon={ClipboardCheck} title="最近已配送（已锁定）" hint="仅支持抽查" />
        {recent.length === 0 ? (
          <EmptyState text="暂无已配送记录" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recent.map((f) => {
              const cyl = cylinderMap.get(f.cylinder_code);
              return (
                <div
                  key={f.id}
                  className="rounded-lg border border-ink-700 bg-ink-900/40 p-3 opacity-80"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-ink-100">
                      {f.cylinder_code}
                    </span>
                    <Lock className="w-4 h-4 text-ink-400" />
                  </div>
                  <div className="font-mono text-xs text-ink-400 space-y-0.5">
                    <div>门店：{f.store ?? '—'}</div>
                    <div>配送员：{f.courier ?? '—'}</div>
                    <div>重量：{f.filling_weight} / {f.target_weight} kg</div>
                    {f.recheck_count > 0 && (
                      <div className="text-recheck-400">复称 {f.recheck_count} 次</div>
                    )}
                    {cyl?.locked === 1 && (
                      <div className="text-hazard-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> 钢瓶已锁定
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-ink-500 mt-2 font-mono">
                    <Eye className="w-3 h-3" />
                    {new Date(f.created_at).toLocaleString('zh-CN', { hour12: false })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
