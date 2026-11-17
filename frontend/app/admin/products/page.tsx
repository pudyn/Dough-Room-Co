"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Plus, Search, Edit, ToggleLeft, ToggleRight, Trash2, Download, Flame } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import type { Product } from "@/types";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search],
    queryFn: async () => {
      const { data } = await api.get("/products", { params: { page, per_page: 20, search } });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dihapus");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus produk"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.patch(`/products/${id}/toggle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Status produk diperbarui");
    },
  });

  const recommendedMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/products/${id}/recommended`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Status rekomendasi diperbarui");
    },
    onError: () => toast.error("Gagal update rekomendasi"),
  });

  const products: Product[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
        <div className="flex gap-2 flex-wrap">
        <button onClick={() => exportToExcel(products, [
          { key: "name", label: "Nama" },
          { key: "sku", label: "SKU" },
          { key: "category_name", label: "Kategori" },
          { key: "selling_price", label: "Harga Jual", format: v => String(v ?? 0) },
          { key: "cost_price", label: "Harga Modal", format: v => String(v ?? 0) },
          { key: "stock_quantity", label: "Stok", format: v => String(v ?? 0) },
          { key: "is_active", label: "Status", format: v => v ? "Aktif" : "Nonaktif" },
          { key: "is_recommended", label: "Rekomendasi", format: v => v ? "Ya" : "Tidak" },
        ], "produk")} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export
        </button>
        <a href="/admin/products/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Tambah Produk
        </a>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Cari produk atau SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Produk</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Kategori</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Harga</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Stok</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Mode</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat...</td></tr>
            )}
            {!isLoading && products.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Tidak ada produk</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">🍩</div>
                    )}
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 text-gray-500">{p.category_name ?? "-"}</td>
                <td className="px-4 py-3 text-right font-medium">{formatIDR(p.selling_price)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={p.stock_quantity <= p.low_stock_threshold ? "text-red-600 font-medium" : "text-gray-700"}>
                    {p.stock_tracking ? p.stock_quantity : "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {(p.sales_modes ?? []).map((m) => (
                      <span key={m} className="badge-status bg-blue-50 text-blue-700">{m === "READY_STOCK" ? "RS" : "PO"}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate({ id: p.id })}
                      title={p.is_active ? "Nonaktifkan produk" : "Aktifkan produk"}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {p.is_active ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} />}
                    </button>
                    <button
                      onClick={() => recommendedMutation.mutate(p.id)}
                      title={p.is_recommended ? "Hapus dari rekomendasi" : "Jadikan produk rekomendasi (HOT)"}
                      className={p.is_recommended ? "text-orange-500" : "text-gray-300 hover:text-orange-400"}
                    >
                      <Flame size={18} className={p.is_recommended ? "fill-orange-500" : ""} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a href={`/admin/products/${p.id}`} className="text-primary-600 hover:text-primary-700">
                      <Edit size={16} />
                    </a>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} produk</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Produk"
        message={`Produk "${deleteTarget?.name}" akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
