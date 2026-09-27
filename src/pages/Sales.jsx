import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getSales, createSale, getBatches, exportSales, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { SalesIcon } from '../components/icons.jsx';

const empty = { gramsSold: '', percentage: '', sellingPricePerGram: '', saleDate: '' };

export default function Sales() {
  const { query = '' } = useOutletContext() ?? {};
  const [sales, setSales] = useState([]);
  const [openBatches, setOpenBatches] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formError, setFormError] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!dropOpen) return;
    const onDown = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropOpen]);

  const load = () => {
    getSales().then((res) => setSales(asArray(res.data))).catch(() => {});
    getBatches({ status: 'OPEN' }).then((res) => setOpenBatches(asArray(res.data))).catch(() => {});
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => `${s.batchNumber} ${(s.batchNumbers || []).join(' ')} ${s.batchId}`.toLowerCase().includes(q));
  }, [sales, query]);

  const totalRevenue = sales.reduce((a, s) => a + (Number(s.totalSellingPrice) || 0), 0);
  const totalProfit = sales.reduce((a, s) => a + (Number(s.profitLoss) || 0), 0);

  const selectedBatches = useMemo(
    () => openBatches.filter((b) => selectedIds.includes(String(b.id))),
    [openBatches, selectedIds]
  );
  const isMulti = selectedIds.length > 1;
  // Combined totals — weight and buying price summed across the selection.
  const totalWeight = selectedBatches.reduce((a, b) => a + (Number(b.gramsRemaining) || 0), 0);
  const totalCost = selectedBatches.reduce(
    (a, b) => a + (Number(b.gramsRemaining) || 0) * (Number(b.pricePerGram) || 0),
    0
  );

  const dropLabel = selectedBatches.length === 0
    ? 'Select a batch'
    : selectedBatches.length === 1
      ? `${selectedBatches[0].batchNumber} — ${selectedBatches[0].itemName} (${formatGrams(selectedBatches[0].gramsRemaining)} left)`
      : `${selectedBatches.map((b) => b.batchNumber).join(', ')} (${selectedBatches.length} batches)`;

  const toggleBatch = (id) => {
    const key = String(id);
    const next = selectedIds.includes(key)
      ? selectedIds.filter((x) => x !== key)
      : [...selectedIds, key];
    setSelectedIds(next);
    // Single selection → prefill the weight with its full remaining stock.
    if (next.length === 1) {
      const only = openBatches.find((b) => String(b.id) === next[0]);
      if (only && (form.gramsSold === '' || form.gramsSold == null)) {
        setForm((f) => ({ ...f, gramsSold: String(only.gramsRemaining ?? '') }));
      }
    } else {
      setForm((f) => ({ ...f, gramsSold: '' }));
    }
  };

  // Effective sale weight: always the manually entered "New weight"
  // (weighed after removing impurities). totalWeight below is display-only.
  const soldNum = Number(form.gramsSold);
  const pctNum = form.percentage === '' || form.percentage == null ? 100 : Number(form.percentage);
  const priceNum = Number(form.sellingPricePerGram);
  const pctValid = Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100;
  // Final amount: weight × percentage × market price (continued from totals).
  const previewTotal =
    Number.isFinite(soldNum) && soldNum > 0 && pctValid && Number.isFinite(priceNum) && priceNum >= 0
      ? (soldNum * pctNum * priceNum) / 100
      : null;
  const previewPayable =
    Number.isFinite(soldNum) && soldNum > 0 && pctValid ? (soldNum * pctNum) / 100 : null;
  const previewCost = isMulti
    ? totalCost
    : selectedBatches.length === 1 && Number.isFinite(soldNum) && soldNum > 0
      ? soldNum * (Number(selectedBatches[0].pricePerGram) || 0)
      : null;
  const previewProfit =
    previewTotal != null && previewCost != null ? previewTotal - previewCost : null;

  const singleBatch = selectedBatches.length === 1 ? selectedBatches[0] : null;
  const overStock =
    singleBatch && !isMulti && Number.isFinite(Number(form.gramsSold)) && Number(form.gramsSold) > 0
      ? Number(form.gramsSold) > Number(singleBatch.gramsRemaining) + 1e-9
      : false;
  const multiOverStock =
    isMulti && Number.isFinite(soldNum) && soldNum > 0
      ? soldNum > totalWeight + 1e-9
      : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (selectedIds.length === 0) {
      setFormError('Select at least one batch.');
      return;
    }
    if (!Number.isFinite(soldNum) || soldNum <= 0) {
      setFormError('Enter the new weight after removing impurities.');
      return;
    }
    if (!pctValid) {
      setFormError('Percentage must be between 0 and 100.');
      return;
    }
    if (overStock) {
      setFormError(
        `Only ${formatGrams(singleBatch.gramsRemaining)} remaining in ${singleBatch.batchNumber}.`
      );
      return;
    }
    if (multiOverStock) {
      setFormError(
        `New weight exceeds combined stock (${formatGrams(totalWeight)} total).`
      );
      return;
    }
    setSubmitting(true);
    try {
      if (isMulti) {
        await createSale({
          batchIds: selectedIds.map(Number),
          gramsSold: soldNum,
          purityPercentage: pctNum,
          sellingPricePerGram: Number(form.sellingPricePerGram),
          saleDate: form.saleDate || new Date().toISOString().slice(0, 10),
        });
      } else {
        await createSale({
          batchId: Number(selectedIds[0]),
          gramsSold: Number(form.gramsSold),
          purityPercentage: pctNum,
          sellingPricePerGram: Number(form.sellingPricePerGram),
          saleDate: form.saleDate || new Date().toISOString().slice(0, 10),
        });
      }
      setForm(empty);
      setSelectedIds([]);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Could not record sale. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportSales();
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales</h1>
          <p className="text-[13px] text-[#8A8A8A]">{formatKES(totalRevenue)} revenue · <span className={totalProfit >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}>{formatKES(totalProfit)} profit</span></p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="text-[13px] font-semibold border border-[#E3DCCB] rounded-full px-4 py-2 bg-white hover:border-black disabled:opacity-50">
          {exporting ? 'Preparing…' : 'Export .xlsx'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record sale</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] lg:col-span-1">Batch
            <span ref={dropRef} className="relative block">
              <button
                type="button"
                onClick={() => setDropOpen((v) => !v)}
                className="flex items-center justify-between gap-2 text-left font-normal"
                style={{ background: '#fff', border: '1px solid #E3DCCB', color: '#1A1A1A', padding: '0.55rem 0.75rem', fontSize: '0.875rem', borderRadius: '10px', width: '100%' }}
              >
                <span className={`truncate ${selectedIds.length === 0 ? 'text-[#B0A893]' : ''}`}>{dropLabel}</span>
                <span className="text-[#8A8A8A] text-xs shrink-0">▾</span>
              </button>
              {dropOpen && (
                <span className="absolute z-20 left-0 right-0 mt-1 block bg-white border border-[#E3DCCB] rounded-[10px] shadow-lg max-h-52 overflow-y-auto">
                  {openBatches.length === 0 && (
                    <span className="block px-3 py-2 text-[13px] font-normal text-[#8A8A8A]">No open batches</span>
                  )}
                  {openBatches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#FAF7F0] text-[13px] font-normal text-[#1A1A1A]">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(String(b.id))}
                        onChange={() => toggleBatch(b.id)}
                        className="accent-black shrink-0 grow-0"
                        style={{ width: '1rem', height: '1rem' }}
                      />
                      <span className="min-w-0 flex-1 text-left truncate">{b.batchNumber} — {b.itemName} ({formatGrams(b.gramsRemaining)} left)</span>
                    </label>
                  ))}
                </span>
              )}
            </span>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">New weight (g)
            <input
              required
              type="number" step="0.01" min="0"
              value={form.gramsSold}
              onChange={(e) => setForm({ ...form, gramsSold: e.target.value })}
              placeholder="Weight after removing impurities"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Percentage (%)
            <input
              type="number" step="0.01" min="0" max="100"
              value={form.percentage}
              onChange={(e) => setForm({ ...form, percentage: e.target.value })}
              placeholder="100"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Market price / g (KES)
            <input required type="number" step="0.01" value={form.sellingPricePerGram} onChange={(e) => setForm({ ...form, sellingPricePerGram: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Sale date
            <input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting} className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px] flex-1">
              {submitting ? 'Recording…' : '+ Record sale'}
            </button>
          </div>
        </div>
        {isMulti && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] bg-[#FAF7F0] border border-[#E3DCCB] px-3 py-2.5 text-[12px] tabular">
            <span className="font-bold text-black">
              {selectedBatches.length} batches combined
            </span>
            <span className="text-[#5C5C5C]">
              Total weight: <span className="font-bold text-black">{formatGrams(totalWeight)}</span>
            </span>
            <span className="text-[#5C5C5C]">
              Total buying: <span className="font-bold text-black">{formatKES(totalCost)}</span>
            </span>
          </div>
        )}
        {previewTotal != null && (
          <p className="text-[12px] text-[#8A8A8A] mt-2 tabular">
            Total: <span className="font-bold text-black">{formatKES(previewTotal)}</span>
            <span> — {formatGrams(soldNum)} × {pctNum}% × {formatKES(priceNum)}/g</span>
            {previewPayable != null && pctNum !== 100 && (
              <span> · payable {formatGrams(previewPayable)}</span>
            )}
            {isMulti && (
              <span> · buying {formatKES(totalCost)}</span>
            )}
            {previewProfit != null && (
              <span className={previewProfit >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}>
                {' '}· {previewProfit >= 0 ? '+' : ''}{formatKES(previewProfit)} profit
              </span>
            )}
          </p>
        )}
        {overStock && (
          <p className="text-[12px] font-medium text-[#E5484D] mt-2">
            Exceeds remaining stock ({formatGrams(singleBatch?.gramsRemaining)} left).
          </p>
        )}
        {multiOverStock && (
          <p className="text-[12px] font-medium text-[#E5484D] mt-2">
            New weight exceeds combined stock ({formatGrams(totalWeight)} total).
          </p>
        )}
        {formError && (
          <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-3">{formError}</p>
        )}
      </form>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All sales</h2>
          <span className="text-[12px] text-[#8A8A8A]">Weight · % · total · P/L</span>
        </div>
        <AnimatePresence initial={false}>
          {filtered.map((s) => {
            const sold = Number(s.gramsSold) || 0;
            const pct = Number(s.purityPercentage ?? s.percentage ?? 100) || 100;
            const showPct = Math.abs(pct - 100) > 0.005;
            const numbers = Array.isArray(s.batchNumbers) && s.batchNumbers.length > 0
              ? s.batchNumbers
              : [s.batchNumber ?? s.batchId];
            const multi = (s.batchCount ?? numbers.length) > 1;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
                <span className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#E8620C] flex items-center justify-center shrink-0"><SalesIcon className="w-5 h-5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">
                    {numbers.join(', ')}
                    {multi && <span className="ml-1.5 text-[11px] font-medium text-[#8A8A8A]">{numbers.length} batches</span>}
                  </span>
                  <span className="block text-[12px] text-[#8A8A8A]">
                    {formatDate(s.saleDate)} · {formatGrams(sold)}{showPct && ` · ${pct}%`}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[13px] font-bold tabular">{formatKES(s.totalSellingPrice)}</span>
                  <span className={`inline-block mt-0.5 badge ${(s.profitLoss ?? 0) >= 0 ? 'badge-green' : 'badge-red'} tabular`}>
                    {(s.profitLoss ?? 0) >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                  </span>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No sales recorded yet.</p>}
      </div>
    </div>
  );
}
