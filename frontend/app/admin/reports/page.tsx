"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { todayJakarta, toDateInputValue } from "@/lib/date";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#3b82f6","#f59e0b","#ef4444","#10b981","#8b5cf6","#ec4899","#14b8a6"];

type ReportTab = "sales" | "products" | "payments" | "preorder";

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => todayJakarta());
  const [groupBy, setGroupBy] = useState("day");

  const { data: salesData } = useQuery({
    queryKey: ["report-sales", dateFrom, dateTo, groupBy],
    queryFn: async () => { const { data } = await api.get("/reports/sales", { params: { date_from: dateFrom, date_to: dateTo, group_by: groupBy } }); return data.data; },
    enabled: tab === "sales",
  });

  const { data: productsData } = useQuery({
    queryKey: ["report-products", dateFrom, dateTo],
    queryFn: async () => { const { data } = await api.get("/reports/products", { params: { date_from: dateFrom, date_to: dateTo } }); return data.data; },
    enabled: tab === "products",
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["report-payments", dateFrom, dateTo],
    queryFn: async () => { const { data } = await api.get("/reports/payments", { params: { date_from: dateFrom, date_to: dateTo } }); return data.data; },
    enabled: tab === "payments",
  });

  const tabs = [
    { key: "sales", label: "Penjualan" },
    { key: "products", label: "Produk" },
    { key: "payments", label: "Pembayaran" },
  ] as const;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>

      {/* Date range */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Dari</label>
          <input className="input text-sm py-1.5" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sampai</label>
          <input className="input text-sm py-1.5" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {tab === "sales" && (
          <select className="input text-sm py-1.5 w-auto" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <option value="day">Harian</option>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
          </select>
        )}
        <div className="flex gap-1 ml-auto">
          {[7,30,90].map(d => (
            <button key={d} onClick={() => { const f = new Date(); f.setDate(f.getDate() - (d-1)); setDateFrom(toDateInputValue(f)); setDateTo(todayJakarta()); }}
              className="btn-secondary text-xs px-3 py-1">{d}H</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sales tab */}
      {tab === "sales" && (
        <div className="space-y-4">
          {/* Summary cards */}
          {salesData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Penjualan", value: formatIDR(salesData.summary.total_revenue) },
                { label: "Total Transaksi", value: salesData.summary.total_orders },
                { label: "Rata-rata Transaksi", value: formatIDR(salesData.summary.avg_order_value) },
                { label: "Total Item Terjual", value: salesData.summary.total_items },
              ].map((s, i) => (
                <div key={i} className="card">
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Grafik Penjualan</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesData?.chart ?? []}>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatIDR(v)} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]} name="Penjualan" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Products tab */}
      {tab === "products" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Produk Terlaris (Qty)</h2>
            <div className="space-y-2">
              {(productsData?.by_quantity ?? []).slice(0,10).map((p: { product_name: string; total_sold: number; revenue: number }, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5">{i+1}</span>
                    <span className="text-gray-800">{p.product_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{p.total_sold} pcs</p>
                    <p className="text-xs text-gray-500">{formatIDR(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Distribusi Penjualan</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={(productsData?.by_quantity ?? []).slice(0,7)} dataKey="total_sold" nameKey="product_name" cx="50%" cy="50%" outerRadius={100}>
                  {(productsData?.by_quantity ?? []).slice(0,7).map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payments tab */}
      {tab === "payments" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Metode Pembayaran</h2>
            <div className="space-y-3">
              {(paymentsData?.by_method ?? []).map((p: { payment_method: string; count: number; amount: number }, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></div>
                    <span className="text-sm font-medium text-gray-800">{p.payment_method}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatIDR(p.amount)}</p>
                    <p className="text-xs text-gray-500">{p.count} transaksi</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Sumber Pesanan</h2>
            <div className="space-y-3">
              {(paymentsData?.by_source ?? []).map((s: { source: string; count: number; amount: number }, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-800">{s.source}</span>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatIDR(s.amount)}</p>
                    <p className="text-xs text-gray-500">{s.count} pesanan</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
