import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, MapPin, User, Send, PackageCheck } from 'lucide-react';
import { Panel, SectionTitle, Field, BlockBanner, Spinner, EmptyState } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAppStore } from '../store';
import type { Cylinder, DeliveryRecord, FillingRecord } from '@shared/types';
import { cn } from '../lib/utils';

export default function Delivery() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [cylinders, setCylinders] = useState<Cylinder[]>([]);
  const [fillings, setFillings] = useState<FillingRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [code, setCode] = useState('');
  const [person, setPerson] = useState('李配送');
  const [destination, setDestination] = useState('');
  const [recipient, setRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [blockMsg, setBlockMsg] = useState<{ code: string; message: string } | null>(null);

  const refresh = useCallback(async () => {
    const [c, f, d] = await Promise.all([api.listCylinders(), api.listFillings(), api.listDeliveries()]);
    setCylinders(c);
    setFillings(f);
    setDeliveries(d);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const latestByCode = useMemo(() => {
    const map = new Map<string, FillingRecord>();
    for (const f of fillings) {
      const cur = map.get(f.cylinder_code);
      if (!cur || f.id > cur.id) map.set(f.cylinder_code, f);
    }
    return map;
  }, [fillings]);

  const deliverable = cylinders
    .map((c) => ({ cylinder: c, filling: latestByCode.get(c.cylinder_code) }))
    .filter((x) => x.filling && x.filling.status === 'normal' && x.filling.delivered === 0);

  const selectedFilling = code ? latestByCode.get(code) : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) {
      pushToast({ kind: 'warn', title: '请选择钢瓶' });
      return;
    }
    if (!destination) {
      pushToast({ kind: 'warn', title: '请填写流向地址' });
      return;
    }
    setSubmitting(true);
    setBlockMsg(null);
    try {
      const rec = await api.createDelivery({
        cylinder_code: code,
        delivery_person: person,
        destination,
        recipient: recipient || undefined,
      });
      pushToast({ kind: 'ok', title: '配送已确认', message: `${code} → ${destination}` });
      setCode('');
      setDestination('');
      setRecipient('');
      refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setBlockMsg({ code: e.code ?? 'ERR', message: e.message });
        pushToast({ kind: 'block', title: '配送阻断', message: e.message, code: e.code });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="stat-num text-3xl text-ink-100 tracking-wide">配送作业台</h1>
        <p className="text-sm text-ink-400 mt-1">确认钢瓶流向 · 复称未通过或已配送的钢瓶将被阻断</p>
      </div>

      {deliverable.length > 0 && (
        <Panel>
          <SectionTitle icon={PackageCheck} title="可配送钢瓶" hint={`${deliverable.length} 瓶就绪`} />
          <div className="flex flex-wrap gap-2">
            {deliverable.map(({ cylinder, filling }) => (
              <button
                key={cylinder.id}
                onClick={() => {
                  setCode(cylinder.cylinder_code);
                  setBlockMsg(null);
                }}
                className={cn(
                  'chip cursor-pointer transition-colors',
                  code === cylinder.cylinder_code
                    ? 'border-ok-500/60 bg-ok-500/15 text-ok-300'
                    : 'border-ink-700 bg-ink-900/60 text-ink-300 hover:border-ink-500',
                )}
              >
                {cylinder.cylinder_code}
                <span className="opacity-50">#{filling!.id}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <SectionTitle icon={Truck} title="配送登记" hint="确认流向" />
          <form onSubmit={submit} className="space-y-4">
            <Field label="钢瓶码">
              <input
                className="input"
                list="dlv-list"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setBlockMsg(null);
                }}
                placeholder="选择或输入钢瓶码"
              />
              <datalist id="dlv-list">
                {cylinders.map((c) => (
                  <option key={c.id} value={c.cylinder_code} />
                ))}
              </datalist>
            </Field>

            {selectedFilling && (
              <div className="rounded-lg border border-ink-700 bg-ink-950/50 p-3 font-mono text-xs flex items-center justify-between">
                <span className="text-ink-400">
                  最近充装 #{selectedFilling.id} · {selectedFilling.filling_weight}kg
                </span>
                {selectedFilling.status === 'recheck' ? (
                  <span className="chip border-recheck-500/50 bg-recheck-500/10 text-recheck-400">复称中 · 不可配送</span>
                ) : selectedFilling.delivered ? (
                  <span className="chip border-hazard-600/50 bg-hazard-500/10 text-hazard-400">已配送</span>
                ) : (
                  <span className="chip border-ok-600/50 bg-ok-500/10 text-ok-400">正常 · 可配送</span>
                )}
              </div>
            )}

            <Field label="配送员">
              <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} />
            </Field>
            <Field label="流向地址">
              <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="如：幸福小区12-3" />
            </Field>
            <Field label="收件人 (可选)">
              <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="如：张三" />
            </Field>

            {blockMsg && <BlockBanner code={blockMsg.code} message={blockMsg.message} />}

            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner /> : <Send className="w-4 h-4" />}
              确认配送
            </button>
          </form>
        </Panel>

        <Panel>
          <SectionTitle icon={MapPin} title="配送流向记录" />
          {deliveries.length === 0 ? (
            <EmptyState text="暂无配送记录" />
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {deliveries.map((d) => (
                <div key={d.id} className="rounded-lg border border-ink-800 bg-ink-950/50 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-ink-100">{d.cylinder_code}</span>
                    <span className="font-mono text-[10px] text-ink-500">#{d.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-ink-200">
                    <MapPin className="w-3.5 h-3.5 text-safety-400 shrink-0" />
                    {d.destination}
                    {d.recipient && <span className="text-ink-400">· {d.recipient}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-ink-500">
                    <User className="w-3 h-3" />
                    {d.delivery_person}
                    <span className="ml-auto">{new Date(d.delivered_at).toLocaleString('zh-CN', { hour12: false })}</span>
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
