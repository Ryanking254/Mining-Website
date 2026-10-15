import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { getBatches, getSales, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { BatchesIcon } from '../components/icons.jsx';

// History — every batch that has been fully sold (status CLOSED).
// Sold batches live here so the Batches page only shows stock still available.
export default function History() {
  const { query = '' } = useOutletContext() ?? {};
  const [batches, setBatches] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    getBatches({ status: 'CLOSED' }).then((res) => setBatches(asArray(res.data))).catch(() => {});
    getSales().then((res) => setSales(asArray(res.data))).catch(() => {});
  }, []);

  // Sales that consumed each batch (single + multi-batch sales).
  const salesByBatch = useMemo(() => {
    const map = new Map();
    for (const s of sales) {
      const ids = Array.isArray(s.batchIds) && s.batchIds.length > 0
        ? s.batchIds
        : s.batchId != null ? [s.batchId] : [];
      for (const id of ids) {
        const key = String(id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      }
    }
    return map;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return batches;
    return batches.filter((b) => `${b.itemName} ${b.batchNumber}`.toLowerCase().includes(q));
  }, [batches, query]);

  const totalCost = filtered.reduce((a, b) => a + (Number(b.totalCost) || 0), 0);
  const totalWeight = filtered.reduce((a, b) => a + (Number(b.gramsBought) || 0), 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">History</h1>
          <p className="text-[13px] text-[#8A8A8A]">
            {batches.length} sold {batches.length === 1 ? 'batch' : 'batches'} · {formatGrams(totalWeight)} sold · {formatKES(totalCost)} cost
          </p>
        </div>
        <Link to="/batches" className="text-[13px] font-semibold border border-[#E3DCCB] rounded-full px-4 py-2 bg-white hover:border-black">
          View available
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">Sold batches</h2>
          <span className="text-[12px] text-[#8A8A8A]">Bought · cost/g · sale</span>
        </div>
        <AnimatePresence initial={false}>
          {filtered.map((b) => {
            const linked = salesByBatch.get(String(b.id)) ?? [];
            const revenue = linked.reduce((a, s) => a + (Number(s.totalSellingPrice) || 0), 0);
            const lastSale = linked
              .map((s) => String(s.saleDate || '').slice(0, 10))
              .filter(Boolean)
              .sort()
              .pop();
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
                <span className="w-10 h-10 rounded-xl bg-[#F6F1E8] text-[#5C5C5C] flex items-center justify-center shrink-0"><BatchesIcon className="w-5 h-5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">{b.itemName}</span>
                    <span className="badge badge-gray">sold</span>
                  </span>
                  <span className="block text-[12px] text-[#8A8A8A]">
                    {b.batchNumber} · bought {formatDate(b.purchaseDate)}
                    {lastSale && ` · sold ${formatDate(lastSale)}`}
                    {linked.length > 1 && ` · ${linked.length} sales`}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[13px] font-bold tabular">{formatGrams(b.gramsBought)} · {formatKES(b.pricePerGram)}/g</span>
                  <span className="block text-[12px] text-[#8A8A8A] tabular">
                    cost {formatKES(b.totalCost)}
                    {linked.length > 0 && <> · sold {formatKES(revenue)}</>}
                  </span>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">
            No sold batches yet — fully sold batches will move here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
