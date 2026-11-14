"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QrCode, Download, ExternalLink, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";

type QRCode = { id: string; code: string; label: string; url: string; is_active: boolean; created_at: string };

export default function QRPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [targetType, setTargetType] = useState("STORE");
  const [deleteTarget, setDeleteTarget] = useState<QRCode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["qr-codes"],
    queryFn: async () => { const { data } = await api.get("/qr"); return data.data as QRCode[]; },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/qr", { name: label, target_type: targetType });
      return data.data;
    },
    onSuccess: () => {
      toast.success("QR Code dibuat");
      qc.invalidateQueries({ queryKey: ["qr-codes"] });
      setShowForm(false);
      setLabel("");
    },
    onError: () => toast.error("Gagal membuat QR Code"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/qr/${id}`); },
    onSuccess: () => {
      toast.success("QR Code dihapus");
      qc.invalidateQueries({ queryKey: ["qr-codes"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus QR Code"),
  });

  function downloadQR(url: string, label: string) {
    const link = document.createElement("a");
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
    link.download = `qr-${label}.png`;
    link.target = "_blank";
    link.click();
  }

  const qrCodes = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Buat QR Code
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Cara Penggunaan</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Cetak QR Code dan tempel di meja atau kasir</li>
          <li>Pelanggan scan untuk melihat menu dan langsung memesan</li>
          <li>Tipe <strong>Store</strong> untuk order di tempat, <strong>Catalog</strong> untuk katalog online</li>
        </ul>
      </div>

      {isLoading && <p className="text-center text-gray-400 py-8">Memuat...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {qrCodes.map(qr => (
          <div key={qr.id} className={`card text-center ${!qr.is_active ? "opacity-50" : ""}`}>
            <div className="bg-white border border-gray-200 rounded-xl p-3 mx-auto w-fit mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr.url)}`}
                alt={qr.label}
                className="w-32 h-32"
              />
            </div>
            <p className="font-semibold text-gray-900">{qr.label}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{qr.code}</p>
            <p className="text-xs text-gray-400 mt-1 break-all px-2">{qr.url}</p>

            <div className="flex gap-2 mt-3 justify-center">
              <button onClick={() => window.open(qr.url, "_blank")} className="btn-secondary text-xs flex items-center gap-1">
                <ExternalLink size={12} /> Buka
              </button>
              <button onClick={() => downloadQR(qr.url, qr.label)} className="btn-secondary text-xs flex items-center gap-1">
                <Download size={12} /> Download
              </button>
              <button onClick={() => setDeleteTarget(qr)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && qrCodes.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <QrCode size={48} className="text-gray-300 mx-auto" />
          <p className="text-gray-400 text-sm">Belum ada QR Code. Klik tombol di atas untuk membuat.</p>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">Buat QR Code</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); generateMutation.mutate(); }} className="p-4 space-y-3">
              <div>
                <label className="label">Nama / Label</label>
                <input
                  className="input"
                  required
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Contoh: Meja 1, Kasir Depan"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Tipe</label>
                <select className="input" value={targetType} onChange={e => setTargetType(e.target.value)}>
                  <option value="STORE">Store — Order di tempat</option>
                  <option value="CATALOG">Catalog — Katalog online</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" disabled={generateMutation.isPending || !label.trim()}>
                  {generateMutation.isPending ? "Membuat..." : "Buat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus QR Code"
        message={`QR Code "${deleteTarget?.label}" akan dihapus. Lanjutkan?`}
        confirmLabel="Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
