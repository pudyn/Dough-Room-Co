"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type BankAccount = { id: string; bank_name: string; account_number: string; account_holder: string; is_active: boolean };
type Settings = Record<string, string>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Settings>({
    store_name: "",
    store_address: "",
    store_phone: "",
    store_whatsapp: "",
    order_expiry_minutes: "60",
    max_preorder_quantity: "100",
  });
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", account_holder: "" });
  const [showBankForm, setShowBankForm] = useState(false);

  const { data: storeSettings } = useQuery<Settings>({
    queryKey: ["store-settings-admin"],
    queryFn: async () => {
      try { const { data } = await api.get("/store/settings"); return data.data; }
      catch { return {}; }
    },
  });

  const { data: banks } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: async () => { const { data } = await api.get("/bank-accounts"); return data.data; },
  });

  useEffect(() => {
    if (storeSettings) setSettings(prev => ({ ...prev, ...storeSettings }));
  }, [storeSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        if (value) await api.post("/store/settings", { key, value }).catch(() => {});
      }
    },
    onSuccess: () => { toast.success("Pengaturan disimpan"); qc.invalidateQueries({ queryKey: ["store-settings-admin"] }); },
    onError: () => toast.error("Gagal menyimpan"),
  });

  const addBankMutation = useMutation({
    mutationFn: async () => { await api.post("/bank-accounts", bankForm); },
    onSuccess: () => {
      toast.success("Rekening ditambahkan");
      setBankForm({ bank_name: "", account_number: "", account_holder: "" });
      setShowBankForm(false);
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: () => toast.error("Gagal menambah rekening"),
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/bank-accounts/${id}`); },
    onSuccess: () => { toast.success("Rekening dihapus"); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
    onError: () => toast.error("Gagal menghapus"),
  });

  const toggleBankMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { await api.put(`/bank-accounts/${id}`, { is_active: active }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });

  const fields = [
    { key: "store_name", label: "Nama Toko", type: "text" },
    { key: "store_address", label: "Alamat Toko", type: "text" },
    { key: "store_phone", label: "No. Telepon", type: "tel" },
    { key: "store_whatsapp", label: "No. WhatsApp", type: "tel" },
    { key: "order_expiry_minutes", label: "Batas Waktu Pembayaran (menit)", type: "number" },
    { key: "max_preorder_quantity", label: "Maks. Kuantitas Pre-Order per Produk", type: "number" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>

      {/* Store settings */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Informasi Toko</h2>
        {fields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" type={f.type} value={settings[f.key] ?? ""} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} />
          </div>
        ))}
        <button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}
          className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saveSettingsMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>

      {/* Bank accounts */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rekening Bank</h2>
          <button onClick={() => setShowBankForm(!showBankForm)} className="btn-secondary flex items-center gap-1 text-sm"><Plus size={14} /> Tambah</button>
        </div>

        {showBankForm && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Nama Bank *</label>
                <input className="input text-sm" value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="BCA" />
              </div>
              <div>
                <label className="label text-xs">No. Rekening *</label>
                <input className="input text-sm font-mono" value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs">Nama Pemilik *</label>
                <input className="input text-sm" value={bankForm.account_holder} onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBankForm(false)} className="btn-secondary text-sm flex-1">Batal</button>
              <button onClick={() => addBankMutation.mutate()} disabled={addBankMutation.isPending || !bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder}
                className="btn-primary text-sm flex-1">
                {addBankMutation.isPending ? "Menyimpan..." : "Tambah Rekening"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(banks ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Belum ada rekening bank</p>}
          {(banks ?? []).map(b => (
            <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border ${b.is_active ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
              <div>
                <p className="font-semibold text-sm text-gray-900">{b.bank_name}</p>
                <p className="font-mono text-sm text-gray-700">{b.account_number}</p>
                <p className="text-xs text-gray-500">{b.account_holder}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleBankMutation.mutate({ id: b.id, active: !b.is_active })}
                  className={`text-xs px-2 py-1 rounded border font-medium ${b.is_active ? "border-yellow-200 text-yellow-600 hover:bg-yellow-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                  {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button onClick={() => { if (confirm("Hapus rekening ini?")) deleteBankMutation.mutate(b.id); }}
                  className="text-red-400 hover:text-red-600 p-1"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
