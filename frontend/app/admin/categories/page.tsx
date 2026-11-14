"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Pencil, X, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

type Category = { id: string; name: string; description?: string; is_active: boolean; created_at: string };

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories", { params: { per_page: 100 } });
      return data.data as Category[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form);
      } else {
        await api.post("/categories", form);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Kategori diperbarui" : "Kategori ditambahkan");
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: () => toast.error("Gagal menyimpan kategori"),
  });

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description ?? "" });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setShowForm(true);
  }

  const categories: Category[] = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kategori</h1>
        <div className="flex gap-2">
        <button onClick={() => exportToExcel(categories, [
          { key: "name", label: "Nama" },
          { key: "description", label: "Deskripsi" },
          { key: "is_active", label: "Status", format: v => v ? "Aktif" : "Nonaktif" },
          { key: "created_at", label: "Dibuat", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "" },
        ], "kategori")} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export
        </button>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Tambah Kategori
        </button>
        </div>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editing ? "Edit Kategori" : "Kategori Baru"}</h2>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 hover:bg-gray-100 rounded">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Nama *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama kategori" />
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Deskripsi singkat (opsional)" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1">Batal</button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim()}
              className="btn-primary flex-1"
            >
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deskripsi</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dibuat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>}
            {!isLoading && categories.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada kategori</td></tr>
            )}
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.description ?? "-"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
