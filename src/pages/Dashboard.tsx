import { useCallback, useEffect, useState } from 'react';
import {
  Gauge,
  Activity,
  Flame,
  Truck,
  ShieldAlert,
  Ban,
  Scale,
  Lock,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { Panel, SectionTitle, StatCard, BlockBanner, BlockCodeBadge, Spinner, EmptyState } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store';
import type { AnomalyLog, Stats } from '@shared/types';
import { cn } from '../lib/utils';

type DemoKind = 'overdue' | 'overtol' | 'locked';
type DemoResult =
  | { kind: 'idle' }
  | { kind: 'block'; code: string; message: string; title: string }
  | { kind: 'recheck'; code: string; message: string; title: string }
  | { kind: 'ok'; title: string; message: string };

const DEMOS: { key: DemoKind; icon: typeof Ban; label: string; desc: string; cylinder: string }[] = [
  { key: 'overdue', icon: Ban, label: '① 超期未检阻断', desc: '对 LPG-2025-0002(已超期) 发起充装', cylinder: 'LPG-2025-0002' },
  { key: 'overtol', icon: Scale, label: '② 重量超差转复称', desc: '对 LPG-2025-0003 充装 51.5kg(超差)', cylinder: 'LPG-2025-0003' },
  { key: 'locked', icon: Lock, label: '③ 已配送记录锁定', desc: '修改 LPG-2025-0004 已配送充装记录', cylinder: 'LPG-2025-0004' },
];

export default function Dashboard() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [stats, setStats] = useState<Stats | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<DemoKind | null>(null);
  const [result, setResult] = useState<DemoResult>({ kind: 'idle' });
  const [refreshedAt, setRefreshedAt] = useState('');

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([api.getStats(), api.listAnomalies(50)]);
    setStats(s);
    setAnomalies(a);
    setRefreshedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runDemo(kind: DemoKind) {
    setRunning(kind);
    setResult({ kind: 'idle' });
    try {
      if (kind === 'overdue') {
        await api.createFilling({
          cylinder_code: 'LPG-2025-0002',
          filling_weight: 15.0,
          operator: '演示员',
          station: '城东充装站',
        });
        setResult({ kind: 'ok', title: '未阻断', message: '异常: 超期钢瓶被放行，请检查规则' });
      } else if (kind === 'overtol') {
        const rec = await api.createFilling({
          cylinder_code: 'LPG-2025-0003',
          filling_weight: 51.5,
          operator: '演示员',
          station: '城南充装站',
        });
        setResult({
          kind: 'recheck',
          code: 'WEIGHT_OUT_OF_TOLERANCE',
          title: '重量超差 · 转入复称',
          message: `记录 #${rec.id} 偏差 ${rec.weight_diff! > 0 ? '+' : ''}${rec.weight_diff}kg 超出允差，已转入复称队列`,
        });
        pushToast({ kind: 'warn', title: '转入复称', message: `偏差 ${rec.weight_diff}kg 超差`, code: 'WEIGHT_OUT_OF_TOLERANCE' });
      } else {
        const fillings = await api.listFillings({ code: 'LPG-2025-0004' });
        const delivered = fillings.find((f) => f.delivered === 1);
        if (!delivered) {
          setResult({ kind: 'ok', title: '无已配送记录', message: '未找到 LPG-2025-0004 的已配送记录，请先重置数据' });
          return;
        }
        await api.modifyFilling(delivered.id, 15.2);
        setResult({ kind: 'ok', title: '未阻断', message: '异常: 已配送记录被修改，请检查规则' });
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'CYLINDER_OVERDUE') {
          setResult({ kind: 'block', code: e.code, message: e.message, title: '超期未检 · 充装阻断' });
          pushToast({ kind: 'block', title: '充装阻断', message: e.message, code: e.code });
        } else if (e.code === 'RECORD_LOCKED_DELIVERED') {
          setResult({ kind: 'block', code: e.code, message: e.message, title: '已配送 · 记录锁定' });
          pushToast({ kind: 'block', title: '修改阻断', message: e.message, code: e.code });
        } else if (e.code === 'WEIGHT_OUT_OF_TOLERANCE') {
          setResult({ kind: 'block', code: e.code, message: e.message, title: '配送阻断' });
          pushToast({ kind: 'block', title: '配送阻断', message: e.message, code: e.code });
        } else {
          setResult({ kind: 'block', code: e.code ?? 'ERR', message: e.message, title: '请求失败' });
          pushToast({ kind: 'block', title: '请求失败', message: e.message, code: e.code });
        }
      } else {
        setResult({ kind: 'block', code: 'ERR', message: String(e), title: '错误' });
      }
    } finally {
      setRunning(null);
      refresh();
    }
  }

  async function resetDemo() {
    setLoading(true);
    await api.demoReset();
    setResult({ kind: 'idle' });
    pushToast({ kind: 'info', title: '数据已重置', message: '演示数据恢复初始状态' });
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="stat-num text-3xl text-ink-100 tracking-wide">总控台</h1>
          <p className="text-sm text-ink-400 mt-1">
            液化气瓶充装追溯 · 异常阻断控制系统
            <span className="ml-2 font-mono text-xs text-ink-500">REAL-TIME</span>
          </p>
        </div>
        <button onClick={resetDemo} className="btn btn-ghost" disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          重置演示数据
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="在册钢瓶" value={stats?.cylinders ?? '—'} icon={Flame} />
        <StatCard label="今日充装" value={stats?.fillings_today ?? '—'} unit="瓶" icon={Gauge} />
        <StatCard label="已配送" value={stats?.in_delivery ?? '—'} unit="瓶" icon={Truck} tone="ok" />
        <StatCard label="异常记录" value={stats?.blocked_count ?? '—'} unit="条" icon={ShieldAlert} tone="danger" />
        <StatCard label="检验异常率" value={stats?.inspection_abnormal_rate ?? '—'} unit="%" icon={Activity} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <SectionTitle
            icon={Cpu}
            title="异常阻断演示"
            hint="按下按钮触发真实规则引擎"
          />
          <div className="space-y-2.5">
            {DEMOS.map((d) => (
              <button
                key={d.key}
                onClick={() => runDemo(d.key)}
                disabled={running !== null}
                className={cn(
                  'w-full text-left rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3 transition-colors',
                  'hover:border-safety-600/60 hover:bg-ink-800/60 disabled:opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-ink-800 flex items-center justify-center shrink-0">
                    {running === d.key ? <Spinner /> : <d.icon className="w-4 h-4 text-safety-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink-100">{d.label}</div>
                    <div className="text-xs text-ink-400 font-mono mt-0.5">{d.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {result.kind !== 'idle' && (
            <div className="mt-4">
              {result.kind === 'block' && (
                <BlockBanner code={result.code} message={result.message} />
              )}
              {result.kind === 'recheck' && (
                <div className="rounded-lg border border-recheck-500/50 bg-recheck-500/10 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Scale className="w-5 h-5 text-recheck-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-mono text-xs font-semibold text-recheck-300 tracking-wide">
                        软阻断 · {result.code}
                      </div>
                      <p className="text-sm text-ink-100 mt-0.5">{result.message}</p>
                    </div>
                  </div>
                </div>
              )}
              {result.kind === 'ok' && (
                <div className="rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-ink-300 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-ink-200">{result.title}</div>
                      <p className="text-xs text-ink-400 mt-0.5">{result.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle
            icon={Activity}
            title="实时异常日志"
            hint={`更新于 ${refreshedAt || '—'}`}
          />
          {anomalies.length === 0 ? (
            <EmptyState text="暂无异常记录" />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {anomalies.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-ink-800 bg-ink-950/50 px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <BlockCodeBadge code={a.block_code} />
                    <span className="font-mono text-[10px] text-ink-500 shrink-0">
                      #{String(a.id).padStart(4, '0')}
                    </span>
                  </div>
                  <p className="text-xs text-ink-200 leading-relaxed">{a.detail}</p>
                  <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-ink-500">
                    {a.cylinder_code && <span>{a.cylinder_code}</span>}
                    {a.operator && <span>· {a.operator}</span>}
                    <span className="ml-auto">
                      {new Date(a.created_at).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
