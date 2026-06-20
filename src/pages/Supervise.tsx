import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ShieldCheck,
  Search,
  ClipboardCheck,
  AlertOctagon,
  Fuel,
  Truck,
  Microscope,
  History,
  Lock,
  Unlock,
  Scale,
  Store,
  CalendarCheck,
  FileCheck,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  Panel,
  SectionTitle,
  Field,
  BlockCodeBadge,
  FillingStatusBadge,
  InspectionResultBadge,
  StatCard,
  EmptyState,
  LockTypeBadge,
  InfoBanner,
  LockBanner,
  Spinner,
} from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store';
import type { AnomalyLog, Inspection, Stats, TraceRecord, Cylinder, CylinderLock, SpotCheck, FillingRecord, InspectionResult } from '@shared/types';
import { cn } from '../lib/utils';

export default function Supervise() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [traceCode, setTraceCode] = useState('LPG-2025-0004');
  const [trace, setTrace] = useState<TraceRecord | null>(null);
  const [inspCode, setInspCode] = useState('LPG-2025-0002');
  const [inspResult, setInspResult] = useState<InspectionResult>('abnormal');
  const [inspRemark, setInspRemark] = useState('');
  const [lockedCylinders, setLockedCylinders] = useState<Cylinder[]>([]);
  const [spotChecks, setSpotChecks] = useState<SpotCheck[]>([]);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [activeTab, setActiveTab] = useState<'trace' | 'locked' | 'spotcheck'>('trace');

  const [spotCheckFilling, setSpotCheckFilling] = useState<{
    fillingId: number;
    cylinderCode: string;
    store: string | null;
  } | null>(null);
  const [spotCheckInspector, setSpotCheckInspector] = useState('监管员');
  const [spotCheckResult, setSpotCheckResult] = useState<InspectionResult>('abnormal');
  const [spotCheckRemark, setSpotCheckRemark] = useState('');
  const [spotCheckLoading, setSpotCheckLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [a, ins, s, locked, spots] = await Promise.all([
      api.listAnomalies(200),
      api.listInspections(),
      api.getStats(),
      api.listLockedCylinders().catch(() => []),
      api.listSpotChecks().catch(() => []),
    ]);
    setAnomalies(a);
    setInspections(ins);
    setStats(s);
    setLockedCylinders(locked);
    setSpotChecks(spots);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function searchTrace(e: FormEvent) {
    e.preventDefault();
    setLoadingTrace(true);
    try {
      const t = await api.getTrace(traceCode);
      setTrace(t);
    } catch {
      setTrace(null);
      pushToast({ kind: 'warn', title: '未找到', message: `${traceCode} 不存在` });
    } finally {
      setLoadingTrace(false);
    }
  }

  async function doInspect(e: FormEvent) {
    e.preventDefault();
    try {
      const rec = await api.createInspection({
        cylinder_code: inspCode,
        inspector: '监管员',
        result: inspResult,
        remark: inspRemark || undefined,
      });
      pushToast({
        kind: inspResult === 'pass' ? 'ok' : 'block',
        title: '抽查已记录',
        message: `${inspCode} · ${inspResult === 'pass' ? '合格' : inspResult === 'abnormal' ? '异常' : '查扣'}`,
      });
      setInspRemark('');
      refresh();
      setTraceCode(inspCode);
      const t = await api.getTrace(inspCode);
      setTrace(t);
    } catch (e) {
      pushToast({ kind: 'block', title: '抽查失败', message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleUnlock(code: string) {
    if (!confirm(`确定要解锁钢瓶 ${code} 吗？解锁后将允许该钢瓶继续充装和配送。`)) return;
    try {
      await api.unlockCylinder(code);
      pushToast({ kind: 'ok', title: '已解锁', message: `${code} 钢瓶锁定已解除` });
      refresh();
      if (trace?.cylinder.cylinder_code === code) {
        const t = await api.getTrace(code);
        setTrace(t);
      }
    } catch (e) {
      pushToast({ kind: 'block', title: '解锁失败', message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleLocksClick(code: string) {
    setTraceCode(code);
    setActiveTab('trace');
    setLoadingTrace(true);
    try {
      const t = await api.getTrace(code);
      setTrace(t);
    } catch {
      setTrace(null);
    } finally {
      setLoadingTrace(false);
    }
  }

  function openSpotCheckModal(filling: FillingRecord) {
    setSpotCheckFilling({
      fillingId: filling.id,
      cylinderCode: filling.cylinder_code,
      store: filling.store ?? null,
    });
    setSpotCheckResult('abnormal');
    setSpotCheckRemark('');
  }

  async function submitSpotCheck(e: FormEvent) {
    e.preventDefault();
    if (!spotCheckFilling) return;
    setSpotCheckLoading(true);
    try {
      await api.createSpotCheck({
        cylinder_code: spotCheckFilling.cylinderCode,
        filling_id: spotCheckFilling.fillingId,
        inspector: spotCheckInspector,
        result: spotCheckResult,
        remark: spotCheckRemark || undefined,
      });
      pushToast({
        kind: spotCheckResult === 'pass' ? 'ok' : 'block',
        title: '抽查已记录',
        message: `${spotCheckFilling.cylinderCode} · ${spotCheckResult === 'pass' ? '合格' : spotCheckResult === 'abnormal' ? '异常' : '查扣'}`,
      });
      setSpotCheckFilling(null);
      refresh();
      if (trace?.cylinder.cylinder_code === spotCheckFilling.cylinderCode) {
        const t = await api.getTrace(spotCheckFilling.cylinderCode);
        setTrace(t);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ kind: 'block', title: '抽查失败', message: e.message, code: e.code });
      } else {
        pushToast({ kind: 'block', title: '抽查失败', message: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      setSpotCheckLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="stat-num text-3xl text-ink-100 tracking-wide">监管中心</h1>
        <p className="text-sm text-ink-400 mt-1">钢瓶追溯 · 异常抽查 · 锁定管理 · 阻断日志审计</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="在册钢瓶" value={stats?.cylinders ?? '—'} icon={Fuel} />
        <StatCard label="锁定钢瓶" value={lockedCylinders.length} unit="个" icon={Lock} tone="danger" onClick={() => setActiveTab('locked')} />
        <StatCard label="异常记录" value={stats?.blocked_count ?? '—'} unit="条" icon={AlertOctagon} tone="danger" />
        <StatCard label="抽查次数" value={inspections.length + spotChecks.length} unit="次" icon={Microscope} tone="warn" />
      </div>

      <div className="flex gap-1 border-b border-ink-800">
        <button
          onClick={() => setActiveTab('trace')}
          className={cn(
            'px-4 py-2 text-sm font-semibold transition-colors relative',
            activeTab === 'trace'
              ? 'text-safety-400'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          <Search className="w-3.5 h-3.5 inline mr-1.5" />
          异常瓶追踪
          {activeTab === 'trace' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-safety-400" />}
        </button>
        <button
          onClick={() => setActiveTab('locked')}
          className={cn(
            'px-4 py-2 text-sm font-semibold transition-colors relative',
            activeTab === 'locked'
              ? 'text-safety-400'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          <Lock className="w-3.5 h-3.5 inline mr-1.5" />
          锁定钢瓶
          {lockedCylinders.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-hazard-500/20 text-hazard-400">
              {lockedCylinders.length}
            </span>
          )}
          {activeTab === 'locked' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-safety-400" />}
        </button>
        <button
          onClick={() => setActiveTab('spotcheck')}
          className={cn(
            'px-4 py-2 text-sm font-semibold transition-colors relative',
            activeTab === 'spotcheck'
              ? 'text-safety-400'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          <ClipboardCheck className="w-3.5 h-3.5 inline mr-1.5" />
          配送后抽查
          {activeTab === 'spotcheck' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-safety-400" />}
        </button>
      </div>

      {activeTab === 'trace' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Panel>
            <SectionTitle icon={Search} title="钢瓶追溯" hint="全生命周期" />
            <form onSubmit={searchTrace} className="flex gap-2 mb-4">
              <input
                className="input"
                value={traceCode}
                onChange={(e) => setTraceCode(e.target.value)}
                placeholder="输入钢瓶码"
              />
              <button type="submit" className="btn btn-primary px-4" disabled={loadingTrace}>
                {loadingTrace ? <Spinner /> : <Search className="w-4 h-4" />}
                查询
              </button>
            </form>

            {!trace ? (
              <EmptyState text="输入钢瓶码查看追溯链路" />
            ) : (
              <div className="space-y-4">
                {trace.cylinder.locked === 1 && (
                  <LockBanner
                    reason={trace.cylinder.lock_reason}
                    lockedAt={trace.cylinder.locked_at}
                    onUnlock={() => handleUnlock(trace.cylinder.cylinder_code)}
                  />
                )}

                <div className="rounded-lg border border-ink-700 bg-ink-950/50 p-3.5 grid grid-cols-2 gap-3 font-mono text-xs">
                  <Info label="钢瓶码" value={trace.cylinder.cylinder_code} />
                  <Info label="规格" value={trace.cylinder.spec} />
                  <Info label="目标重量" value={`${trace.cylinder.target_weight}kg`} />
                  <Info label="允差" value={`±${trace.cylinder.tolerance}kg`} />
                  <Info label="检验日期" value={trace.cylinder.inspection_date ?? '—'} />
                  <Info
                    label="有效期至"
                    value={trace.cylinder.inspection_expiry ?? '未登记'}
                    tone={!trace.cylinder.inspection_expiry || trace.cylinder.inspection_expiry < new Date().toISOString().slice(0, 10) ? 'danger' : 'ok'}
                  />
                </div>

                {trace.latestInspection && (
                  <div className="rounded-lg border border-safety-500/30 bg-safety-500/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarCheck className="w-4 h-4 text-safety-400" />
                      <span className="label-tag">最近一次检验记录</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <Info label="检验日期" value={trace.latestInspection.inspection_date} />
                      <Info
                        label="检验结果"
                        value={trace.latestInspection.result === 'pass' ? '合格' : trace.latestInspection.result === 'abnormal' ? '异常' : '查扣'}
                        tone={trace.latestInspection.result === 'pass' ? 'ok' : 'danger'}
                      />
                      <Info label="检验员" value={trace.latestInspection.inspector} />
                      <Info label="备注" value={trace.latestInspection.remark ?? '—'} />
                    </div>
                  </div>
                )}

                {trace.latestDelivery && (
                  <div className="rounded-lg border border-ok-500/30 bg-ok-500/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-4 h-4 text-ok-400" />
                      <span className="label-tag">最近一次配送流向</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <Info label="配送门店" value={trace.latestDelivery.destination} tone="ok" />
                      <Info label="配送员" value={trace.latestDelivery.delivery_person} />
                      <Info label="签收人" value={trace.latestDelivery.recipient ?? '—'} />
                      <Info label="配送时间" value={new Date(trace.latestDelivery.delivered_at).toLocaleString('zh-CN', { hour12: false })} />
                    </div>
                  </div>
                )}

                <TraceSection icon={Scale} title="充装称重记录" count={trace.fillings.length} empty="无充装记录">
                  {trace.fillings.map((f) => (
                    <div key={f.id} className="py-2 border-b border-ink-900/60 last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-mono text-xs text-ink-200">
                          #{f.id} · {f.filling_weight} / {f.target_weight} kg
                        </div>
                        <div className="flex items-center gap-2">
                          <FillingStatusBadge status={f.status} />
                          {f.delivered && <span className="chip border-ok-600/50 bg-ok-500/10 text-ok-400 text-[10px]">已配送</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-ink-400 flex-wrap">
                        <span className={cn(
                          f.weight_diff! > 0 ? 'text-safety-400' : f.weight_diff! < 0 ? 'text-ok-400' : 'text-ink-400',
                        )}>
                          偏差 {f.weight_diff! > 0 ? '+' : ''}{f.weight_diff}kg
                        </span>
                        {f.recheck_count > 0 && (
                          <span className="text-recheck-400">复称 {f.recheck_count} 次</span>
                        )}
                        {f.store && <span className="text-ok-400">流向: {f.store}</span>}
                        {f.courier && <span>配送员: {f.courier}</span>}
                        <span className="ml-auto">{new Date(f.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                      </div>
                      {f.delivered && (
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => openSpotCheckModal(f)}
                            className="text-[10px] font-mono text-safety-400 hover:text-safety-300 flex items-center gap-1"
                          >
                            <FileCheck className="w-3 h-3" /> 追加抽查结论
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </TraceSection>

                {trace.locks && trace.locks.length > 0 && (
                  <TraceSection icon={Lock} title="锁定历史" count={trace.locks.length} empty="无锁定记录">
                    {trace.locks.map((l: CylinderLock) => (
                      <div key={l.id} className="py-2 border-b border-ink-900/60 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <LockTypeBadge type={l.lock_type} />
                          <span className="font-mono text-[10px] text-ink-500">
                            {new Date(l.locked_at).toLocaleString('zh-CN', { hour12: false })}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-ink-300 mt-1">{l.reason}</div>
                        {l.unlocked_at && (
                          <div className="font-mono text-[10px] text-ok-400 mt-0.5 flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> 已解锁 · {new Date(l.unlocked_at).toLocaleString('zh-CN', { hour12: false })}
                          </div>
                        )}
                      </div>
                    ))}
                  </TraceSection>
                )}

                <TraceSection icon={Truck} title="配送记录" count={trace.deliveries.length} empty="无配送记录">
                  {trace.deliveries.map((d) => (
                    <div key={d.id} className="py-1.5 border-b border-ink-900/60 last:border-0">
                      <div className="font-mono text-xs text-ink-200">→ {d.destination} {d.recipient && `· ${d.recipient}`}</div>
                      <div className="font-mono text-[10px] text-ink-500">{d.delivery_person} · {new Date(d.delivered_at).toLocaleString('zh-CN', { hour12: false })}</div>
                    </div>
                  ))}
                </TraceSection>

                {trace.spotChecks && trace.spotChecks.length > 0 && (
                  <TraceSection icon={FileCheck} title="配送后抽查" count={trace.spotChecks.length} empty="无抽查记录">
                    {trace.spotChecks.map((sc: SpotCheck) => (
                      <div key={sc.id} className="flex items-center justify-between py-1.5 border-b border-ink-900/60 last:border-0">
                        <div>
                          <span className="font-mono text-xs text-ink-300">{sc.remark || '无备注'}</span>
                          <div className="font-mono text-[10px] text-ink-500">{sc.inspector} · {new Date(sc.created_at).toLocaleString('zh-CN', { hour12: false })}</div>
                        </div>
                        <InspectionResultBadge result={sc.result} />
                      </div>
                    ))}
                  </TraceSection>
                )}

                <TraceSection icon={Microscope} title="检验记录" count={trace.inspections.length} empty="无检验记录">
                  {trace.inspections.map((i) => (
                    <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-ink-900/60 last:border-0">
                      <div>
                        <span className="font-mono text-xs text-ink-300">{i.remark || '无备注'}</span>
                        <div className="font-mono text-[10px] text-ink-500">{i.inspector} · {new Date(i.created_at).toLocaleString('zh-CN', { hour12: false })}</div>
                      </div>
                      <InspectionResultBadge result={i.result} />
                    </div>
                  ))}
                </TraceSection>
              </div>
            )}
          </Panel>

          <div className="space-y-5">
            <Panel>
              <SectionTitle icon={ClipboardCheck} title="异常抽查登记" hint="抽查异常瓶" />
              <form onSubmit={doInspect} className="space-y-3">
                <Field label="钢瓶码">
                  <input className="input" value={inspCode} onChange={(e) => setInspCode(e.target.value)} placeholder="LPG-2025-0002" />
                </Field>
                <Field label="抽查结果">
                  <div className="grid grid-cols-3 gap-2">
                    {(['pass', 'abnormal', 'seized'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInspResult(r)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                          inspResult === r
                            ? r === 'pass'
                              ? 'border-ok-500/60 bg-ok-500/15 text-ok-300'
                              : r === 'abnormal'
                                ? 'border-hazard-500/60 bg-hazard-500/15 text-hazard-300'
                                : 'border-hazard-600/80 bg-hazard-500/25 text-hazard-200'
                            : 'border-ink-700 bg-ink-900/60 text-ink-400 hover:border-ink-500',
                        )}
                      >
                        {r === 'pass' ? '合格' : r === 'abnormal' ? '异常' : '查扣'}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="备注">
                  <input className="input" value={inspRemark} onChange={(e) => setInspRemark(e.target.value)} placeholder="如：阀门锈蚀" />
                </Field>
                <button type="submit" className="btn btn-primary w-full">
                  <ShieldCheck className="w-4 h-4" /> 提交抽查
                </button>
              </form>
            </Panel>

            <Panel>
              <SectionTitle icon={AlertOctagon} title="阻断日志审计" hint={`${anomalies.length} 条`} />
              {anomalies.length === 0 ? (
                <EmptyState text="暂无阻断记录" />
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {anomalies.map((a) => (
                    <div key={a.id} className="rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <BlockCodeBadge code={a.block_code} />
                        <span className="font-mono text-[10px] text-ink-500">#{a.id}</span>
                      </div>
                      <p className="text-xs text-ink-200 leading-relaxed">{a.detail}</p>
                      <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-ink-500">
                        {a.cylinder_code && <span>{a.cylinder_code}</span>}
                        <span className="ml-auto">{new Date(a.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {activeTab === 'locked' && (
        <Panel>
          <SectionTitle
            icon={Lock}
            title="锁定钢瓶管理"
            hint={`${lockedCylinders.length} 个待处理`}
            right={
              <button onClick={refresh} className="btn btn-ghost py-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> 刷新
              </button>
            }
          />
          {lockedCylinders.length === 0 ? (
            <EmptyState text="当前无锁定钢瓶" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedCylinders.map((c) => (
                <div key={c.id} className="rounded-lg border border-hazard-600/40 bg-hazard-500/5 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-ink-100">{c.cylinder_code}</div>
                      <div className="font-mono text-[10px] text-ink-400 mt-0.5">{c.spec} · {c.target_weight}kg</div>
                    </div>
                    <Lock className="w-5 h-5 text-hazard-400 animate-pulse" />
                  </div>
                  <div className="font-mono text-xs space-y-1 mb-3">
                    {c.lock_reason && (
                      <div className="text-ink-300 break-words">
                        <span className="text-ink-500">锁定原因：</span>
                        {c.lock_reason}
                      </div>
                    )}
                    {c.locked_at && (
                      <div className="text-ink-400">
                        <span className="text-ink-500">锁定时间：</span>
                        {new Date(c.locked_at).toLocaleString('zh-CN', { hour12: false })}
                      </div>
                    )}
                    <div className={cn(
                      !c.inspection_expiry || c.inspection_expiry < new Date().toISOString().slice(0, 10)
                        ? 'text-hazard-400'
                        : 'text-ok-400',
                    )}>
                      <span className="text-ink-500">检验有效期：</span>
                      {c.inspection_expiry ?? '未登记'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLocksClick(c.cylinder_code)}
                      className="btn btn-ghost flex-1 py-2 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> 查看追溯
                    </button>
                    <button
                      onClick={() => handleUnlock(c.cylinder_code)}
                      className="btn btn-primary flex-1 py-2 text-xs"
                    >
                      <Unlock className="w-3.5 h-3.5" /> 解锁
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'spotcheck' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Panel>
            <SectionTitle icon={FileCheck} title="配送后抽查记录" hint={`${spotChecks.length} 条`} />
            {spotChecks.length === 0 ? (
              <div className="text-center py-12">
                <InfoBanner message="暂无抽查记录。请在「异常瓶追踪」页选择已配送的充装记录，点击「追加抽查结论」进行抽查登记。" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {spotChecks.slice().reverse().map((sc) => (
                  <div key={sc.id} className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-semibold text-ink-100">{sc.cylinder_code}</span>
                      <InspectionResultBadge result={sc.result} />
                    </div>
                    <div className="font-mono text-xs text-ink-400 space-y-0.5">
                      <div>充装记录 #{sc.filling_id}</div>
                      {sc.remark && <div className="text-ink-300">{sc.remark}</div>}
                      <div className="text-ink-500">
                        {sc.inspector} · {new Date(sc.created_at).toLocaleString('zh-CN', { hour12: false })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="space-y-5">
            <Panel>
              <SectionTitle icon={ClipboardCheck} title="抽查说明" />
              <div className="space-y-3 text-sm text-ink-300">
                <div className="flex items-start gap-2">
                  <FileCheck className="w-4 h-4 text-safety-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-ink-200">配送后记录锁定</div>
                    <div className="text-xs text-ink-400 mt-0.5">配送员确认流向后，原充装记录自动锁定，禁止修改、删除、复称。</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="w-4 h-4 text-safety-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-ink-200">仅可追加抽查结论</div>
                    <div className="text-xs text-ink-400 mt-0.5">监管人员如需补充信息，必须通过「抽查」功能追加结论，不影响原始记录。</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <History className="w-4 h-4 text-safety-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-ink-200">完整审计追踪</div>
                    <div className="text-xs text-ink-400 mt-0.5">所有抽查记录独立存储，包含时间戳和操作人，支持完整追溯。</div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionTitle icon={Microscope} title="如何进行抽查" />
              <ol className="space-y-2 text-sm text-ink-300 list-decimal list-inside">
                <li className="text-ink-400">进入「异常瓶追踪」标签页</li>
                <li className="text-ink-400">输入或选择钢瓶码进行查询</li>
                <li className="text-ink-400">在「充装称重记录」中找到已配送的记录</li>
                <li className="text-ink-400">点击记录右下角的「追加抽查结论」链接</li>
                <li className="text-ink-400">填写抽查结果和备注，提交即可</li>
              </ol>
            </Panel>
          </div>
        </div>
      )}

      {spotCheckFilling && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="panel w-full max-w-md p-5 animate-riseIn">
            <SectionTitle icon={FileCheck} title="追加抽查结论" />
            <div className="mb-4 p-3 rounded-lg border border-ink-700 bg-ink-950/50">
              <div className="font-mono text-sm text-ink-100 mb-1">{spotCheckFilling.cylinderCode}</div>
              <div className="font-mono text-xs text-ink-400">
                充装记录 #{spotCheckFilling.fillingId}
                {spotCheckFilling.store && ` · 流向: ${spotCheckFilling.store}`}
              </div>
            </div>
            <form onSubmit={submitSpotCheck} className="space-y-3">
              <Field label="抽查人员">
                <input className="input" value={spotCheckInspector} onChange={(e) => setSpotCheckInspector(e.target.value)} />
              </Field>
              <Field label="抽查结果">
                <div className="grid grid-cols-3 gap-2">
                  {(['pass', 'abnormal', 'seized'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSpotCheckResult(r)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                        spotCheckResult === r
                          ? r === 'pass'
                            ? 'border-ok-500/60 bg-ok-500/15 text-ok-300'
                            : r === 'abnormal'
                              ? 'border-hazard-500/60 bg-hazard-500/15 text-hazard-300'
                              : 'border-hazard-600/80 bg-hazard-500/25 text-hazard-200'
                          : 'border-ink-700 bg-ink-900/60 text-ink-400 hover:border-ink-500',
                      )}
                    >
                      {r === 'pass' ? '合格' : r === 'abnormal' ? '异常' : '查扣'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="抽查备注">
                <input className="input" value={spotCheckRemark} onChange={(e) => setSpotCheckRemark(e.target.value)} placeholder="如：瓶体有锈蚀" />
              </Field>
              <InfoBanner message="此操作将向该充装记录追加独立的抽查记录，不会修改原始充装数据。" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpotCheckFilling(null)}
                  className="btn btn-ghost flex-1"
                  disabled={spotCheckLoading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={spotCheckLoading}
                >
                  {spotCheckLoading ? <Spinner /> : <ShieldCheck className="w-4 h-4" />}
                  提交抽查
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'ok' }) {
  const cls = tone === 'danger' ? 'text-hazard-400' : tone === 'ok' ? 'text-ok-400' : 'text-ink-200';
  return (
    <div>
      <div className="text-ink-500 mb-0.5">{label}</div>
      <div className={cls}>{value}</div>
    </div>
  );
}

function TraceSection({
  icon: Icon,
  title,
  count,
  empty,
  children,
}: {
  icon: typeof Fuel;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-safety-400" />
        <span className="label-tag">{title}</span>
        <span className="font-mono text-[10px] text-ink-500">{count} 条</span>
      </div>
      {count === 0 ? (
        <div className="font-mono text-xs text-ink-500 py-2">{empty}</div>
      ) : (
        <div className="px-1">{children}</div>
      )}
    </div>
  );
}
