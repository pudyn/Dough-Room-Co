"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import clsx from "clsx";

type Register = {
  id: string;
  name: string;
  opening_balance: number;
  closing_balance: number | null;
  opened_by_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  total_sales: number;
  total_orders: number;
};

export default function CashierPage() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["registers", page, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get("/pos/registers", {
        params: {
          page,
          per_page: 20,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      return data;
    },
  });

  const registers: Register[] = data?.data ?? [];
  const meta = data?.meta;

  function formatDt(d: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function duration(openedAt: string, closedAt: string | null) {
    if (!closedAt) return "Masih buka";
    const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}j ${minutes}m`;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Kasir</h1>
        <button
          onClick={() =>
            exportToExcel(
              registers,
              [
                { key: "name", label: "Nama Kasir" },
                { key: "opened_by_name", label: "Operator" },
                { key: "opened_at", label: "Buka", format: (v) => formatDt(v as string) },
                { key: "closed_at", label: "Tutup", format: (v) => formatDt(v as string | null) },
                { key: "opening_balance", label: "Saldo Awal", format: (v) => String(v ?? 0) },
                { key: "closing_balance", label: "Saldo Akhir", format: (v) => v != null ? String(v) : "-" },
                { key: "total_orders", label: "Jumlah Transaksi", format: (v) => String(v ?? 0) },
                { key: "total_sales", label: "Total Penjualan", format: (v) => String(v ?? 0) },
                { key: "status", label: "Status" },
              ],
              "riwayat-kasir"
            )
          }
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="label text-xs">Dari</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <label className="label text-xs">Sampai</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Operator</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Buka</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tutup</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Durasi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo Awal</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo Akhir</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Transaksi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Penjualan</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">Memuat...</td>
              </tr>
            )}
            {!isLoading && registers.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">Belum ada riwayat kasir</td>
              </tr>
            )}
            {registers.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.opened_by_name}</td>
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDt(r.opened_at)}</td>
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDt(r.closed_at)}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">{duration(r.opened_at, r.closed_at)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatIDR(r.opening_balance)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.closing_balance != null ? formatIDR(r.closing_balance) : "-"}
                </td>
                <td className="px-4 py-3 text-center font-medium">{r.total_orders}</td>
                <td className="px-4 py-3 text-right font-medium text-primary-700 whitespace-nowrap">{formatIDR(r.total_sales)}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={clsx(
                      "badge-status text-xs",
                      r.status === "OPEN" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {r.status === "OPEN" ? "Buka" : "Tutup"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} shift</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              ←
            </button>
            <span className="px-3 py-1">
              {page} / {meta.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.total_pages}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
