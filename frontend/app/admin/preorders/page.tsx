"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Plus, ChevronRight, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import clsx from "clsx";

type POPeriod = {
  id: string; name: string; status: string;
  start_at: string; close_at: string; production_date: string;
  pickup_start_at: string; pickup_end_at: string;
  total_orders: number; total_revenue: number;
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

export default function PreordersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", start_at: "", close_at: "", production_date: "", pickup_start_at: "", pickup_end_at: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["preorder-periods"],
    queryFn: async () => { const { data } = await api.get("/preorders"); return data.data as POPeriod[]; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/preorders", form);
    },
    onSuccess: () => {
      toast.success("Periode pre-order dibuat");
      setShowForm(false);
      setForm({ name: "", start_at: "", close_at: "", production_date: "", pickup_start_at: "", pickup_end_at: "" });
      qc.invalidateQueries({ queryKey: ["preorder-periods"] });
    },
    onError: () => toast.error("Gagal membuat periode"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      await api.post(`/preorders/${id}/${action}`);
    },
    onSuccess: () => { toast.success("Status diperbarui"); qc.invalidateQueries({ queryKey: ["preorder-periods"] }); },
    onError: () => toast.error("Gagal update status"),
  });

  const nextStatus: Record<string, { label: string; action: string }> = {
    DRAFT: { label: "Buka PO", action: "open" },
    OPEN: { label: "Tutup PO", action: "close" },
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pre-Order</h1>
        <div className="flex gap-2">
        <button onClick={() => exportToExcel((data ?? []), [
          { key: "name", label: "Nama Periode" },
          { key: "status", label: "Status" },
          { key: "start_at", label: "Dibuka", format: v => v ? new Date(String(v)).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-" },
          { key: "close_at", label: "Ditutup", format: v => v ? new Date(String(v)).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-" },
          { key: "production_date", label: "Tanggal Produksi", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "-" },
          { key: "total_orders", label: "Total Pesanan", format: v => String(v ?? 0) },
          { key: "total_revenue", label: "Total Pendapatan", format: v => String(v ?? 0) },
        ], "preorder")} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export
        </button>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Buat Periode</button>
        </div>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Periode Baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="label">Nama Periode *</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contoh: Pre-Order Lebaran 2025" />
            </div>
            <div>
              <label className="label">Dibuka *</label>
              <input className="input" type="datetime-local" required value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ditutup *</label>
              <input className="input" type="datetime-local" required value={form.close_at} onChange={e => setForm(f => ({ ...f, close_at: e.target.value }))} />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="label">Tanggal Produksi *</label>
              <input className="input" type="date" required value={form.production_date} onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Mulai Ambil *</label>
              <input className="input" type="datetime-local" required value={form.pickup_start_at} onChange={e => setForm(f => ({ ...f, pickup_start_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Selesai Ambil *</label>
              <input className="input" type="datetime-local" required value={form.pickup_end_at} onChange={e => setForm(f => ({ ...f, pickup_end_at: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Batal</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && <p className="text-gray-400 text-sm text-center py-8">Memuat...</p>}
        {!isLoading && (data ?? []).length === 0 && <p className="text-gray-400 text-sm text-center py-8">Belum ada periode pre-order</p>}
        {(data ?? []).map(p => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className={clsx("badge-status text-xs", statusColors[p.status])}>{p.status}</span>
                </div>
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p>Buka: {new Date(p.start_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} — Tutup: {new Date(p.close_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                  <p>Produksi: {new Date(p.production_date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} &nbsp;|&nbsp; Ambil: {new Date(p.pickup_start_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                </div>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-600">{p.total_orders} pesanan</span>
                  <span className="font-medium text-primary-600">{formatIDR(p.total_revenue)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {nextStatus[p.status] && (
                  <button
                    onClick={() => statusMutation.mutate({ id: p.id, action: nextStatus[p.status].action })}
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-xs"
                  >
                    {nextStatus[p.status].label}
                  </button>
                )}
                <a href={`/admin/preorders/${p.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  Detail <ChevronRight size={14} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
