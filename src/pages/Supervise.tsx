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
} from '../components/ui';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import type { AnomalyLog, Inspection, Stats, TraceRecord } from '@shared/types';
import { cn } from '../lib/utils';

export default function Supervise() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [traceCode, setTraceCode] = useState('LPG-2025-0004');
  const [trace, setTrace] = useState<TraceRecord | null>(null);
  const [inspCode, setInspCode] = useState('LPG-2025-0002');
  const [inspResult, setInspResult] = useState<'pass' | 'abnormal' | 'seized'>('abnormal');
  const [inspRemark, setInspRemark] = useState('');

  const refresh = useCallback(async () => {
    const [a, ins, s] = await Promise.all([api.listAnomalies(200), api.listInspections(), api.getStats()]);
    setAnomalies(a);
    setInspections(ins);
    setStats(s);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function searchTrace(e: FormEvent) {
    e.preventDefault();
    try {
      const t = await api.getTrace(traceCode);
      setTrace(t);
    } catch {
      setTrace(null);
      pushToast({ kind: 'warn', title: '未找到', message: `${traceCode} 不存在` });
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="stat-num text-3xl text-ink-100 tracking-wide">监管中心</h1>
        <p className="text-sm text-ink-400 mt-1">钢瓶追溯 · 异常抽查 · 阻断日志审计</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="在册钢瓶" value={stats?.cylinders ?? '—'} icon={Fuel} />
        <StatCard label="异常记录" value={stats?.blocked_count ?? '—'} unit="条" icon={AlertOctagon} tone="danger" />
        <StatCard label="抽查次数" value={inspections.length} unit="次" icon={Microscope} tone="warn" />
        <StatCard label="异常率" value={stats?.inspection_abnormal_rate ?? '—'} unit="%" icon={History} tone="warn" />
      </div>

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
            <button type="submit" className="btn btn-primary px-4">
              <Search className="w-4 h-4" /> 查询
            </button>
          </form>

          {!trace ? (
            <EmptyState text="输入钢瓶码查看追溯链路" />
          ) : (
            <div className="space-y-4">
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

              <TraceSection icon={Fuel} title="充装记录" count={trace.fillings.length} empty="无充装记录">
                {trace.fillings.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-ink-900/60 last:border-0">
                    <span className="font-mono text-xs text-ink-300">
                      #{f.id} · {f.filling_weight}kg (偏差 {f.weight_diff! > 0 ? '+' : ''}{f.weight_diff})
                    </span>
                    <div className="flex items-center gap-2">
                      <FillingStatusBadge status={f.status} />
                      {f.delivered && <span className="chip border-ok-600/50 bg-ok-500/10 text-ok-400">已配送</span>}
                    </div>
                  </div>
                ))}
              </TraceSection>

              <TraceSection icon={Truck} title="配送记录" count={trace.deliveries.length} empty="无配送记录">
                {trace.deliveries.map((d) => (
                  <div key={d.id} className="py-1.5 border-b border-ink-900/60 last:border-0">
                    <div className="font-mono text-xs text-ink-200">→ {d.destination} {d.recipient && `· ${d.recipient}`}</div>
                    <div className="font-mono text-[10px] text-ink-500">{d.delivery_person} · {new Date(d.delivered_at).toLocaleString('zh-CN', { hour12: false })}</div>
                  </div>
                ))}
              </TraceSection>

              <TraceSection icon={Microscope} title="抽查记录" count={trace.inspections.length} empty="无抽查记录">
                {trace.inspections.map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-ink-900/60 last:border-0">
                    <span className="font-mono text-xs text-ink-300">{i.remark || '—'}</span>
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
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-safety-400" />
        <span className="label-tag">{title}</span>
      </div>
      {count === 0 ? (
        <div className="font-mono text-xs text-ink-500 py-1">{empty}</div>
      ) : (
        <div className="px-1">{children}</div>
      )}
    </div>
  );
}
