import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getSales, createSale, getBatches, exportSales, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { SalesIcon } from '../components/icons.jsx';

const empty = { batchId: '', gramsTaken: '', gramsSold: '', sellingPricePerGram: '', saleDate: '' };

export default function Sales() {
  const { query = '' } = useOutletContext() ?? {};
  const [sales, setSales] = useState([]);
  const [openBatches, setOpenBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    getSales().then((res) => setSales(asArray(res.data))).catch(() => {});
    getBatches({ status: 'OPEN' }).then((res) => setOpenBatches(asArray(res.data))).catch(() => {});
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => `${s.batchNumber} ${s.batchId}`.toLowerCase().includes(q));
  }, [sales, query]);

  const totalRevenue = sales.reduce((a, s) => a + (Number(s.totalSellingPrice) || 0), 0);
  const totalProfit = sales.reduce((a, s) => a + (Number(s.profitLoss) || 0), 0);

  const takenNum = Number(form.gramsTaken);
  const soldNum = Number(form.gramsSold);
  const burnLoss =
    Number.isFinite(takenNum) && Number.isFinite(soldNum) && form.gramsTaken !== '' && form.gramsSold !== ''
      ? takenNum - soldNum
      : null;
  const burnInvalid = burnLoss != null && burnLoss < -1e-9;

  const selectedBatch = openBatches.find((b) => String(b.id) === String(form.batchId));
  const overStock =
    selectedBatch && Number.isFinite(takenNum) && form.gramsTaken !== ''
      ? takenNum > Number(selectedBatch.gramsRemaining) + 1e-9
      : selectedBatch && (form.gramsTaken === '' || form.gramsTaken == null) && Number.isFinite(soldNum)
        ? soldNum > Number(selectedBatch.gramsRemaining) + 1e-9
        : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (burnInvalid) {
      setFormError('Weight after burn cannot exceed weight before burn.');
      return;
    }
    if (overStock) {
      setFormError(
        `Only ${formatGrams(selectedBatch.gramsRemaining)} remaining in ${selectedBatch.batchNumber}.`
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        batchId: form.batchId,
        gramsSold: Number(form.gramsSold),
        sellingPricePerGram: Number(form.sellingPricePerGram),
        saleDate: form.saleDate || new Date().toISOString().slice(0, 10),
      };
      // Raw weight before burning (optional — backend defaults to gramsSold).
      if (form.gramsTaken !== '' && form.gramsTaken != null) {
        payload.gramsTaken = Number(form.gramsTaken);
      }
      await createSale(payload);
      setForm(empty);
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
        <p className="text-[13px] font-bold mb-1">Record sale</p>
        <p className="text-[12px] text-[#8A8A8A] mb-3 leading-snug">
          Weigh the metal <span className="font-semibold text-black">before burning</span>, burn off
          impurities, then enter the <span className="font-semibold text-black">weight after burn</span> —
          that is what the buyer pays for. Stock is deducted by the before-burn weight.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] lg:col-span-1">Batch
            <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Select a batch</option>
              {openBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.batchNumber} — {b.itemName} ({formatGrams(b.gramsRemaining)} left)</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Weight before burn (g)
            <input
              type="number" step="0.01" min="0"
              value={form.gramsTaken}
              onChange={(e) => setForm({ ...form, gramsTaken: e.target.value })}
              placeholder="Raw weight taken"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Weight after burn (g) — sold
            <input
              required type="number" step="0.01" min="0"
              value={form.gramsSold}
              onChange={(e) => setForm({ ...form, gramsSold: e.target.value })}
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Price / g (KES)
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
        {burnLoss != null && !burnInvalid && (
          <p className="text-[12px] text-[#8A8A8A] mt-2 tabular">
            Burn loss: <span className="font-semibold text-black">{formatGrams(burnLoss)}</span>
            {burnLoss > 1e-9 && selectedBatch && Number.isFinite(takenNum) ? (
              <> — {formatGrams(takenNum)} removed from {selectedBatch.batchNumber}, {formatGrams(soldNum)} sold.</>
            ) : burnLoss === 0 ? (
              <> — no impurities burned off.</>
            ) : null}
          </p>
        )}
        {(burnInvalid || overStock) && (
          <p className="text-[12px] font-medium text-[#E5484D] mt-2">
            {burnInvalid
              ? 'Weight after burn cannot exceed weight before burn.'
              : `Exceeds remaining stock (${formatGrams(selectedBatch?.gramsRemaining)} left).`}
          </p>
        )}
        {formError && (
          <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-3">{formError}</p>
        )}
      </form>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All sales</h2>
          <span className="text-[12px] text-[#8A8A8A]">Taken → sold · total · P/L</span>
        </div>
        <AnimatePresence initial={false}>
          {filtered.map((s) => {
            const taken = Number(s.gramsTaken ?? s.gramsBeforeBurn ?? s.gramsSold) || 0;
            const sold = Number(s.gramsSold ?? s.gramsAfterBurn) || 0;
            const loss = Number(s.burnLoss ?? taken - sold) || 0;
            const hasBurn = loss > 0.005;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
                <span className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#E8620C] flex items-center justify-center shrink-0"><SalesIcon className="w-5 h-5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{s.batchNumber ?? s.batchId}</span>
                  <span className="block text-[12px] text-[#8A8A8A]">
                    {formatDate(s.saleDate)} · {hasBurn ? `${formatGrams(taken)} → ${formatGrams(sold)}` : formatGrams(sold)}
                    {hasBurn && <span className="text-[#E8620C] font-medium"> · −{formatGrams(loss)} burn</span>}
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
