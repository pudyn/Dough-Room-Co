"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { Plus, Search, Edit, ToggleLeft, ToggleRight, Trash2, X, Eye, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface PromoCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  total_normal_amount: number;
  total_discount: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  code: "",
  name: "",
  description: "",
  discount_type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  discount_value: 0,
  min_order: 0,
  max_discount: null as number | null,
  usage_limit: null as number | null,
  valid_from: "",
  valid_until: "",
};

export default function PromosPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["promos", page, search],
    queryFn: async () => {
      const { data } = await api.get("/promos", { params: { page, per_page: 20, search } });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      if (editId) {
        await api.put(`/promos/${editId}`, payload);
      } else {
        await api.post("/promos", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success(editId ? "Promo diperbarui" : "Promo dibuat");
      closeForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal menyimpan promo"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/promos/${id}/toggle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success("Status promo diperbarui");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/promos/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success("Promo dihapus");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus promo"),
  });

  const promos: PromoCode[] = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: PromoCode) {
    setEditId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_order: p.min_order,
      max_discount: p.max_discount,
      usage_limit: p.usage_limit,
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : "",
      valid_until: p.valid_until ? p.valid_until.slice(0, 16) : "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate(form);
  }

  function formatDate(d: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kode Promo</h1>
        <div className="flex gap-2">
        <button onClick={() => exportToExcel(promos, [
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "discount_type", label: "Tipe Diskon" },
          { key: "discount_value", label: "Nilai Diskon", format: v => String(v ?? 0) },
          { key: "min_order", label: "Min. Order", format: v => String(v ?? 0) },
          { key: "max_discount", label: "Maks. Diskon", format: v => v ? String(v) : "-" },
          { key: "usage_count", label: "Penggunaan", format: v => String(v ?? 0) },
          { key: "usage_limit", label: "Batas", format: v => v ? String(v) : "Tanpa batas" },
          { key: "is_active", label: "Status", format: v => v ? "Aktif" : "Nonaktif" },
          { key: "valid_from", label: "Berlaku Dari", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "-" },
          { key: "valid_until", label: "Berlaku Sampai", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "-" },
        ], "promo")} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export
        </button>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Tambah Promo
        </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Cari kode atau nama promo..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Diskon</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Min. Order</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Penggunaan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Berlaku</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat...</td></tr>
            )}
            {!isLoading && promos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Belum ada kode promo</td></tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-bold text-primary-700">{p.code}</td>
                <td className="px-4 py-3 text-gray-900">{p.name}</td>
                <td className="px-4 py-3">
                  {p.discount_type === "PERCENTAGE"
                    ? `${p.discount_value}%${p.max_discount ? ` (maks ${formatIDR(p.max_discount)})` : ""}`
                    : formatIDR(p.discount_value)}
                </td>
                <td className="px-4 py-3 text-right">{p.min_order > 0 ? formatIDR(p.min_order) : "-"}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => router.push(`/admin/promos/${p.id}`)}
                    className="text-primary-600 hover:underline"
                    title="Lihat riwayat penggunaan"
                  >
                    {p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ""}
                  </button>
                  {p.usage_count > 0 && (
                    <div className="mt-1 text-[11px] leading-tight text-gray-400">
                      <div>normal {formatIDR(p.total_normal_amount)}</div>
                      <div className="text-red-500">diskon −{formatIDR(p.total_discount)}</div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatDate(p.valid_from)} — {formatDate(p.valid_until)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleMutation.mutate(p.id)} className="text-gray-400 hover:text-gray-600">
                    {p.is_active ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => router.push(`/admin/promos/${p.id}`)} title="Detail & riwayat penggunaan" className="text-gray-400 hover:text-primary-600">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => openEdit(p)} className="text-primary-600 hover:text-primary-700" title="Edit">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="text-gray-400 hover:text-red-600" title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} promo</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">{editId ? "Edit Promo" : "Tambah Promo"}</h2>
              <button onClick={closeForm}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kode</label>
                  <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PROMO50" />
                </div>
                <div>
                  <label className="label">Nama</label>
                  <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diskon 50%" />
                </div>
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipe Diskon</label>
                  <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "PERCENTAGE" | "FIXED" })}>
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED">Nominal Tetap (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nilai Diskon</label>
                  <input className="input" type="number" required min={1} value={form.discount_value || ""} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min. Order (Rp)</label>
                  <input className="input" type="number" min={0} value={form.min_order || ""} onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Maks. Diskon (Rp)</label>
                  <input className="input" type="number" min={0} value={form.max_discount ?? ""} onChange={(e) => setForm({ ...form, max_discount: e.target.value ? Number(e.target.value) : null })} placeholder="Tanpa batas" />
                </div>
              </div>
              <div>
                <label className="label">Batas Penggunaan</label>
                <input className="input" type="number" min={0} value={form.usage_limit ?? ""} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })} placeholder="Tanpa batas" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Berlaku Dari</label>
                  <input className="input" type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                </div>
                <div>
                  <label className="label">Berlaku Sampai</label>
                  <input className="input" type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Promo"
        message={`Kode promo "${deleteTarget?.code}" akan dihapus. Lanjutkan?`}
        confirmLabel="Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
