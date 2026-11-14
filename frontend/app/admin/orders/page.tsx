"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Search, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import type { Order } from "@/types";
import clsx from "clsx";

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PREPARING: "bg-indigo-50 text-indigo-700",
  READY: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-50 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
  EXPIRED: "bg-gray-50 text-gray-400",
};

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Bayar",
  CONFIRMED: "Dikonfirmasi",
  PREPARING: "Disiapkan",
  READY: "Siap Ambil",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kadaluarsa",
};

const paymentColors: Record<string, string> = {
  UNPAID: "bg-red-50 text-red-700",
  PENDING: "bg-yellow-50 text-yellow-700",
  PAID: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-600",
  EXPIRED: "bg-gray-50 text-gray-400",
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", page, search, status, source],
    queryFn: async () => {
      const { data } = await api.get("/orders", {
        params: { page, per_page: 25, search, status: status || undefined, source: source || undefined },
      });
      return data;
    },
    refetchInterval: 15000,
  });

  const orders: Order[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">Pesanan</h1>
      <button onClick={() => exportToExcel(orders, [
        { key: "order_number", label: "No. Pesanan" },
        { key: "customer_name", label: "Pelanggan" },
        { key: "source", label: "Sumber" },
        { key: "order_type", label: "Tipe" },
        { key: "subtotal", label: "Subtotal", format: v => String(v ?? 0) },
        { key: "discount_amount", label: "Diskon", format: v => String(v ?? 0) },
        { key: "total_amount", label: "Total", format: v => String(v ?? 0) },
        { key: "order_status", label: "Status" },
        { key: "payment_status", label: "Pembayaran" },
        { key: "created_at", label: "Tanggal", format: v => v ? new Date(String(v)).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "" },
      ], "pesanan")} className="btn-secondary flex items-center gap-2">
        <Download size={16} /> Export
      </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Cari nomor atau nama..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-auto" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
          <option value="">Semua Sumber</option>
          <option value="POS">POS</option>
          <option value="QR_STORE">QR Toko</option>
          <option value="QR_CATALOG">QR Katalog</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">No. Pesanan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pelanggan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sumber</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pembayaran</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat...</td></tr>}
            {!isLoading && orders.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Tidak ada pesanan</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{o.order_number}</td>
                <td className="px-4 py-3 text-gray-700">{o.customer_name ?? "Walk-in"}</td>
                <td className="px-4 py-3">
                  <span className="badge-status bg-gray-100 text-gray-700">{o.source}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatIDR(o.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className={clsx("badge-status", statusColors[o.order_status])}>
                    {statusLabels[o.order_status] ?? o.order_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("badge-status", paymentColors[o.payment_status])}>
                    {o.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(o.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                </td>
                <td className="px-4 py-3">
                  <a href={`/admin/orders/${o.id}`} className="text-primary-600 hover:underline text-xs">Detail</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} pesanan</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
