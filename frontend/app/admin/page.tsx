"use client";

import { useQuery } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { todayJakarta, toDateInputValue } from "@/lib/date";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShoppingCart, TrendingUp, Clock, CheckCircle2, AlertTriangle, Package, Wallet } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const today = todayJakarta();

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/summary", { params: { date_from: today, date_to: today } });
      return data.data;
    },
    refetchInterval: 30000,
  });

  const { data: chartData } = useQuery({
    queryKey: ["dashboard-sales-chart"],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const { data } = await api.get("/dashboard/sales", {
        params: { date_from: toDateInputValue(from), date_to: today, group_by: "day" },
      });
      return data.data;
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      const { data } = await api.get("/dashboard/top-products", {
        params: { date_from: toDateInputValue(from), date_to: today },
      });
      return data.data;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">{new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatIDR(summary?.today_revenue ?? 0)} icon={TrendingUp} color="bg-primary-500" />
        <StatCard label="Keuntungan Hari Ini" value={formatIDR(summary?.today_profit ?? 0)} icon={Wallet} color="bg-emerald-500" />
        <StatCard label="Modal Hari Ini" value={formatIDR(summary?.today_cost ?? 0)} icon={ShoppingCart} color="bg-orange-500" />
        <StatCard label="Transaksi" value={summary?.today_transactions ?? 0} icon={ShoppingCart} color="bg-blue-500" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <StatCard label="Menunggu Bayar" value={summary?.pending_payment ?? 0} icon={Clock} color="bg-yellow-500" />
        <StatCard label="Diproses" value={summary?.processing ?? 0} icon={ShoppingCart} color="bg-indigo-500" />
        <StatCard label="Siap Ambil" value={summary?.ready_for_pickup ?? 0} icon={CheckCircle2} color="bg-green-500" />
        <StatCard label="Stok Menipis" value={summary?.low_stock_count ?? 0} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Penjualan 7 Hari Terakhir</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData ?? []}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatIDR(v)} />
              <Bar dataKey="revenue" fill="#8b4513" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Produk Terlaris (30 Hari)</h2>
          <div className="space-y-3">
            {(topProducts ?? []).slice(0, 5).map((p: { product_name: string; total_sold: number; revenue: number }, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">{p.product_name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{p.total_sold} pcs</p>
                  <p className="text-xs text-gray-500">{formatIDR(p.revenue)}</p>
                </div>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
