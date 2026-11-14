"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Plus, X, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

type Customer = { id: string; name: string; phone: string; email?: string; total_orders: number; created_at: string };

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: async () => {
      const { data } = await api.get("/customers", { params: { page, per_page: 25, search } });
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/customers", form);
      return data.data;
    },
    onSuccess: () => {
      toast.success("Pelanggan ditambahkan");
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "" });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("Gagal menambahkan pelanggan"),
  });

  const customers: Customer[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pelanggan</h1>
        <div className="flex gap-2">
        <button onClick={() => exportToExcel(customers, [
          { key: "name", label: "Nama" },
          { key: "phone", label: "Telepon" },
          { key: "email", label: "Email" },
          { key: "total_orders", label: "Total Order", format: v => String(v ?? 0) },
          { key: "created_at", label: "Terdaftar", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "" },
        ], "pelanggan")} className="btn-secondary flex items-center gap-1 text-sm">
          <Download size={16} /> Export
        </button>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Tambah Pelanggan
        </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Cari nama atau nomor..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">WhatsApp</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total Pesanan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bergabung</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>}
            {!isLoading && customers.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada pelanggan</td></tr>}
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                <td className="px-4 py-3 text-gray-500">{c.email ?? "-"}</td>
                <td className="px-4 py-3 text-right">{c.total_orders ?? 0}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} pelanggan</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}
      {/* Add customer modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Tambah Pelanggan</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Nama *</label>
                <input className="input" placeholder="Nama pelanggan" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">No. WhatsApp *</label>
                <input className="input" placeholder="08xxx" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Email</label>
                <input className="input" placeholder="email@contoh.com" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Batal</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.name || !form.phone || addMutation.isPending}
                className="btn-primary flex-1 disabled:opacity-50">
                {addMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
