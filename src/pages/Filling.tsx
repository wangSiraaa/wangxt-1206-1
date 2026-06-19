import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Fuel,
  ScanLine,
  Scale,
  CheckCircle2,
  Hourglass,
  RefreshCw,
} from 'lucide-react';
import { Panel, SectionTitle, Field, BlockBanner, FillingStatusBadge, Spinner, EmptyState } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store';
import type { Cylinder, FillingRecord } from '@shared/types';
import { cn } from '../lib/utils';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(c: Cylinder | undefined): boolean {
  if (!c) return false;
  if (!c.inspection_expiry) return true;
  return c.inspection_expiry < todayStr();
}

export default function Filling() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [cylinders, setCylinders] = useState<Cylinder[]>([]);
  const [fillings, setFillings] = useState<FillingRecord[]>([]);
  const [code, setCode] = useState('LPG-2025-0001');
  const [weight, setWeight] = useState('');
  const [operator, setOperator] = useState('王充装');
  const [station, setStation] = useState('城东充装站');
  const [inspDate, setInspDate] = useState('');
  const [inspExpiry, setInspExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [blockMsg, setBlockMsg] = useState<{ code: string; message: string } | null>(null);
  const [recheckId, setRecheckId] = useState<number | null>(null);
  const [recheckWeight, setRecheckWeight] = useState('');

  const refresh = useCallback(async () => {
    const [c, f] = await Promise.all([api.listCylinders(), api.listFillings()]);
    setCylinders(c);
    setFillings(f);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cylinder = useMemo(() => cylinders.find((c) => c.cylinder_code === code), [cylinders, code]);
  const overdue = isOverdue(cylinder);

  const recheckQueue = fillings.filter((f) => f.status === 'recheck');
  const recent = fillings.slice(0, 12);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cylinder) {
      pushToast({ kind: 'warn', title: '钢瓶不存在', message: `未找到 ${code}` });
      return;
    }
    const w = Number(weight);
    if (!Number.isFinite(w)) {
      pushToast({ kind: 'warn', title: '重量无效', message: '请输入有效充装重量' });
      return;
    }
    setSubmitting(true);
    setBlockMsg(null);
    try {
      const rec = await api.createFilling({
        cylinder_code: cylinder.cylinder_code,
        filling_weight: w,
        operator,
        station,
      });
      if (rec.status === 'recheck') {
        pushToast({ kind: 'warn', title: '转入复称', message: `偏差 ${rec.weight_diff}kg 超出允差`, code: 'WEIGHT_OUT_OF_TOLERANCE' });
        setRecheckId(rec.id);
      } else {
        pushToast({ kind: 'ok', title: '充装完成', message: `${cylinder.cylinder_code} · ${w}kg 正常` });
      }
      setWeight('');
      refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setBlockMsg({ code: e.code ?? 'ERR', message: e.message });
        pushToast({ kind: 'block', title: '充装阻断', message: e.message, code: e.code });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveInspection() {
    if (!cylinder || !inspDate || !inspExpiry) {
      pushToast({ kind: 'warn', title: '信息不全', message: '请填写检验日期与有效期' });
      return;
    }
    try {
      await api.updateInspection(cylinder.cylinder_code, { inspection_date: inspDate, inspection_expiry: inspExpiry });
      pushToast({ kind: 'ok', title: '检验已登记', message: `${cylinder.cylinder_code} 检验信息已更新` });
      refresh();
    } catch (e) {
      pushToast({ kind: 'block', title: '登记失败', message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function doRecheck(id: number) {
    const w = Number(recheckWeight);
    if (!Number.isFinite(w)) {
      pushToast({ kind: 'warn', title: '复称重量无效' });
      return;
    }
    try {
      const rec = await api.recheck(id, w);
      if (rec.status === 'normal') {
        pushToast({ kind: 'ok', title: '复称通过', message: `${rec.cylinder_code} 已转为正常` });
        setRecheckId(null);
        setRecheckWeight('');
      } else {
        pushToast({ kind: 'warn', title: '复称仍超差', message: '请重新称重', code: 'WEIGHT_OUT_OF_TOLERANCE' });
      }
      refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ kind: 'block', title: '复称阻断', message: e.message, code: e.code });
        if (e.code === 'RECORD_LOCKED_DELIVERED') setRecheckId(null);
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="stat-num text-3xl text-ink-100 tracking-wide">充装作业台</h1>
        <p className="text-sm text-ink-400 mt-1">扫码登记检验日期与充装重量 · 超期与超差实时阻断</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <SectionTitle icon={ScanLine} title="钢瓶扫码登记" hint="STEP 1" />
          <div className="space-y-4">
            <div>
              <span className="label-tag block mb-1.5">选择 / 输入钢瓶码</span>
              <div className="flex gap-2">
                <input
                  className="input"
                  list="cyl-list"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setBlockMsg(null);
                  }}
                  placeholder="LPG-2025-0001"
                />
                <datalist id="cyl-list">
                  {cylinders.map((c) => (
                    <option key={c.id} value={c.cylinder_code} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {cylinders.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCode(c.cylinder_code);
                      setBlockMsg(null);
                    }}
                    className={cn(
                      'chip cursor-pointer transition-colors',
                      code === c.cylinder_code
                        ? 'border-safety-500/60 bg-safety-500/15 text-safety-300'
                        : 'border-ink-700 bg-ink-900/60 text-ink-300 hover:border-ink-500',
                    )}
                  >
                    {c.cylinder_code}
                  </button>
                ))}
              </div>
            </div>

            {cylinder && (
              <div className="rounded-lg border border-ink-700 bg-ink-950/50 p-3.5 grid grid-cols-2 gap-3 font-mono text-xs">
                <Info label="规格" value={cylinder.spec} />
                <Info label="目标重量" value={`${cylinder.target_weight} kg`} />
                <Info label="允差" value={`±${cylinder.tolerance} kg`} />
                <Info label="检验日期" value={cylinder.inspection_date ?? '—'} />
                <Info
                  label="有效期至"
                  value={cylinder.inspection_expiry ?? '未登记'}
                  tone={overdue ? 'danger' : 'ok'}
                />
                <Info
                  label="检验状态"
                  value={overdue ? '超期 / 未检' : '有效'}
                  tone={overdue ? 'danger' : 'ok'}
                />
              </div>
            )}

            {overdue && cylinder && (
              <BlockBanner code="CYLINDER_OVERDUE" message="该钢瓶检验已超期或未登记，禁止充装。可在下方补登记检验信息后重试。" />
            )}

            {cylinder && overdue && (
              <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3.5 space-y-2">
                <div className="label-tag">补登记检验信息</div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="input" value={inspDate} onChange={(e) => setInspDate(e.target.value)} placeholder="检验日期" />
                  <input type="date" className="input" value={inspExpiry} onChange={(e) => setInspExpiry(e.target.value)} placeholder="有效期" />
                </div>
                <button onClick={saveInspection} className="btn btn-ghost w-full">
                  <RefreshCw className="w-4 h-4" /> 登记检验信息
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Fuel} title="充装称重" hint="STEP 2" />
          <form onSubmit={submit} className="space-y-4">
            <Field label="充装重量 (kg)">
              <input
                className="input text-lg"
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={cylinder ? `目标 ${cylinder.target_weight}` : '先选择钢瓶'}
                disabled={!cylinder || overdue}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="充装站">
                <input className="input" value={station} onChange={(e) => setStation(e.target.value)} />
              </Field>
              <Field label="操作员">
                <input className="input" value={operator} onChange={(e) => setOperator(e.target.value)} />
              </Field>
            </div>
            {blockMsg && <BlockBanner code={blockMsg.code} message={blockMsg.message} />}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting || !cylinder || overdue}
            >
              {submitting ? <Spinner /> : <CheckCircle2 className="w-4 h-4" />}
              确认充装登记
            </button>
          </form>
        </Panel>
      </div>

      <Panel>
        <SectionTitle icon={Scale} title="复称队列" hint={`${recheckQueue.length} 待处理`} />
        {recheckQueue.length === 0 ? (
          <EmptyState text="复称队列为空" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recheckQueue.map((f) => (
              <div key={f.id} className="rounded-lg border border-recheck-500/40 bg-recheck-500/5 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-ink-100">{f.cylinder_code}</span>
                  <FillingStatusBadge status={f.status} />
                </div>
                <div className="font-mono text-xs text-ink-400 space-y-0.5">
                  <div>目标 {f.target_weight}kg · 实际 {f.filling_weight}kg</div>
                  <div>偏差 {f.weight_diff! > 0 ? '+' : ''}{f.weight_diff}kg · #{f.id}</div>
                </div>
                {recheckId === f.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input py-1.5 text-sm"
                      type="number"
                      step="0.01"
                      placeholder="复称重量"
                      value={recheckWeight}
                      onChange={(e) => setRecheckWeight(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => doRecheck(f.id)} className="btn btn-primary px-3">
                      <Hourglass className="w-4 h-4" /> 复称
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRecheckId(f.id);
                      setRecheckWeight('');
                    }}
                    className="btn btn-ghost w-full mt-3 py-1.5 text-xs"
                  >
                    <Scale className="w-3.5 h-3.5" /> 发起复称
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle icon={Fuel} title="最近充装记录" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-tag border-b border-ink-800">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">钢瓶码</th>
                <th className="py-2 pr-3 font-medium">实际/目标</th>
                <th className="py-2 pr-3 font-medium">偏差</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 pr-3 font-medium">配送</th>
                <th className="py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-400 font-mono text-xs">暂无记录</td>
                </tr>
              ) : (
                recent.map((f) => (
                  <tr key={f.id} className="border-b border-ink-900/70 hover:bg-ink-900/40">
                    <td className="py-2 pr-3 font-mono text-ink-500">{f.id}</td>
                    <td className="py-2 pr-3 font-mono text-ink-100">{f.cylinder_code}</td>
                    <td className="py-2 pr-3 font-mono text-ink-300">
                      {f.filling_weight} / {f.target_weight}
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      <span className={cn(f.weight_diff! > 0 ? 'text-safety-400' : f.weight_diff! < 0 ? 'text-ok-400' : 'text-ink-400')}>
                        {f.weight_diff! > 0 ? '+' : ''}{f.weight_diff}
                      </span>
                    </td>
                    <td className="py-2 pr-3"><FillingStatusBadge status={f.status} /></td>
                    <td className="py-2 pr-3">
                      {f.delivered ? (
                        <span className="chip border-ok-600/50 bg-ok-500/10 text-ok-400">已配送</span>
                      ) : (
                        <span className="chip border-ink-700 bg-ink-900/60 text-ink-400">未配送</span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-xs text-ink-500">
                      {new Date(f.created_at).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
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
