"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Search, Plus, AlertTriangle, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import type { Product } from "@/types";

type AdjustForm = { product_id: string; type: string; quantity: string; notes: string };

export default function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"adjust" | "restock" | null>(null);
  const [form, setForm] = useState<AdjustForm>({ product_id: "", type: "ADJUSTMENT", quantity: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", page, search],
    queryFn: async () => {
      const { data } = await api.get("/products", { params: { page, per_page: 20, search, stock_tracking: true } });
      return data;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => { const { data } = await api.get("/inventory/low-stock"); return (data.data ?? []) as Product[]; },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const payload = { product_id: form.product_id, type: form.type, quantity: parseInt(form.quantity), notes: form.notes };
      if (modal === "restock") {
        await api.post("/inventory/restocks", payload);
      } else {
        await api.post("/inventory/adjustments", payload);
      }
    },
    onSuccess: () => {
      toast.success("Stok diperbarui");
      setModal(null);
      setForm({ product_id: "", type: "ADJUSTMENT", quantity: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: () => toast.error("Gagal update stok"),
  });

  const products: Product[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventaris</h1>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(products, [
            { key: "name", label: "Produk" },
            { key: "sku", label: "SKU" },
            { key: "stock_quantity", label: "Stok Fisik", format: v => String(v ?? 0) },
            { key: "reserved_quantity", label: "Reserved", format: v => String(v ?? 0) },
            { key: "low_stock_threshold", label: "Ambang", format: v => String(v ?? 0) },
          ], "inventaris")} className="btn-secondary flex items-center gap-2"><Download size={16} /> Export</button>
          <button onClick={() => { setModal("adjust"); setForm(f => ({ ...f, type: "ADJUSTMENT" })); }} className="btn-secondary flex items-center gap-2"><Plus size={16} /> Penyesuaian</button>
          <button onClick={() => { setModal("restock"); setForm(f => ({ ...f, type: "PURCHASE" })); }} className="btn-primary flex items-center gap-2"><Plus size={16} /> Restock</button>
        </div>
      </div>

      {/* Low stock alert */}
      {(lowStock ?? []).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="font-medium text-red-800 text-sm">{lowStock!.length} produk stok menipis</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock!.map(p => (
              <span key={p.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">{p.name} ({p.stock_quantity})</span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Cari produk..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stok Fisik</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stok Tersedia</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Ambang</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>}
            {products.map(p => {
              const isLow = p.stock_quantity <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-right">{p.stock_quantity}</td>
                  <td className="px-4 py-3 text-right font-medium">{p.stock_quantity - (p.reserved_quantity ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.low_stock_threshold}</td>
                  <td className="px-4 py-3">
                    {isLow
                      ? <span className="badge-status bg-red-50 text-red-600">Menipis</span>
                      : <span className="badge-status bg-green-50 text-green-600">Aman</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-gray-900">{modal === "restock" ? "Restock Produk" : "Penyesuaian Stok"}</h3>
            <div>
              <label className="label">Produk *</label>
              <select className="input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">Pilih produk...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (stok: {p.stock_quantity})</option>)}
              </select>
            </div>
            {modal === "adjust" && (
              <div>
                <label className="label">Tipe</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="ADJUSTMENT">Penyesuaian</option>
                  <option value="WASTE">Pemborosan/Rusak</option>
                  <option value="RETURN">Retur</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Jumlah *</label>
              <input className="input" type="number" required value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder={modal === "adjust" ? "Positif atau negatif" : "Jumlah masuk"} />
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsional" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Batal</button>
              <button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || !form.product_id || !form.quantity} className="btn-primary flex-1">
                {adjustMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
