"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

type User = { id: string; name: string; email: string; roles: string[]; is_active: boolean; created_at: string };

type UserForm = { name: string; email: string; password: string; roles: string[] };

const ALL_ROLES = ["OWNER","ADMIN","CASHIER","KITCHEN"];

export default function UsersPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>({ name: "", email: "", password: "", roles: ["CASHIER"] });

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await api.get("/users"); return data.data as User[]; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (modal === "create") {
        await api.post("/users", form);
      } else {
        const payload: Partial<UserForm> = { name: form.name, email: form.email, roles: form.roles };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
      }
    },
    onSuccess: () => {
      toast.success(modal === "create" ? "Pengguna dibuat" : "Pengguna diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Gagal menyimpan"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/users/${id}`); },
    onSuccess: () => { toast.success("Pengguna dihapus"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: () => toast.error("Gagal menghapus"),
  });

  function openEdit(user: User) {
    setEditId(user.id);
    setForm({ name: user.name, email: user.email, password: "", roles: user.roles });
    setModal("edit");
  }

  function openCreate() {
    setForm({ name: "", email: "", password: "", roles: ["CASHIER"] });
    setModal("create");
  }

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pengguna</h1>
        <div className="flex gap-2">
        <button onClick={() => exportToExcel((data ?? []), [
          { key: "name", label: "Nama" },
          { key: "email", label: "Email" },
          { key: "roles", label: "Role", format: v => Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "") },
          { key: "is_active", label: "Status", format: v => v ? "Aktif" : "Nonaktif" },
          { key: "created_at", label: "Bergabung", format: v => v ? new Date(String(v)).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "" },
        ], "pengguna")} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export
        </button>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Tambah Pengguna</button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bergabung</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>}
            {(data ?? []).map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(u.roles ?? []).map(r => <span key={r} className="badge-status bg-purple-50 text-purple-700 text-xs">{r}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge-status text-xs ${u.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.is_active ? "Aktif" : "Nonaktif"}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700"><Edit size={15} /></button>
                    <button onClick={() => { if (confirm(`Hapus ${u.name}?`)) deleteMutation.mutate(u.id); }} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-gray-900">{modal === "create" ? "Tambah Pengguna" : "Edit Pengguna"}</h3>
            <div>
              <label className="label">Nama *</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {modal === "create" && (
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="label">{modal === "create" ? "Password *" : "Password Baru (kosongkan jika tidak diganti)"}</label>
              <input className="input" type="password" required={modal === "create"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {ALL_ROLES.map(r => (
                  <button type="button" key={r} onClick={() => toggleRole(r)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${form.roles.includes(r) ? "bg-primary-500 text-white border-primary-500" : "border-gray-200 text-gray-600"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Batal</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary flex-1">
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
