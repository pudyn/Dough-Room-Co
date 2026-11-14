"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import clsx from "clsx";
import type { Feedback } from "@/types";

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feedbacks", page],
    queryFn: async () => {
      const { data } = await api.get("/feedbacks", { params: { page, per_page: 20 } });
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/feedbacks/${id}/toggle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Status diperbarui");
    },
    onError: () => toast.error("Gagal update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/feedbacks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Kritik & saran dihapus");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus"),
  });

  const feedbacks: Feedback[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Kritik & Saran</h1>
      <p className="text-sm text-gray-500">Masukan dari pelanggan lewat halaman menu. Status &quot;Tampil&quot; menyiapkan masukan untuk ditampilkan publik bila diaktifkan nanti.</p>

      {isLoading && <p className="text-gray-400 text-sm">Memuat...</p>}
      {!isLoading && feedbacks.length === 0 && (
        <div className="card text-center py-10"><p className="text-gray-400 text-sm">Belum ada kritik & saran</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {feedbacks.map((f) => (
          <div key={f.id} className={clsx("card space-y-2", !f.is_visible && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{f.customer_name}</p>
                {f.contact && <p className="text-xs text-gray-400">{f.contact}</p>}
              </div>
              <span className={clsx("badge-status text-[11px]", f.is_visible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
                {f.is_visible ? "Tampil" : "Disembunyikan"}
              </span>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{f.message}</p>
            {f.image_url && (
              <a href={f.image_url} target="_blank" rel="noreferrer">
                <img src={f.image_url} alt="Foto masukan" className="rounded-lg max-h-40 object-cover border" />
              </a>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">{new Date(f.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleMutation.mutate(f.id)}
                  className={clsx(
                    "text-xs px-2 py-1 rounded border font-medium flex items-center gap-1",
                    f.is_visible ? "border-yellow-200 text-yellow-600 hover:bg-yellow-50" : "border-green-200 text-green-600 hover:bg-green-50"
                  )}
                >
                  {f.is_visible ? <><EyeOff size={12} /> Sembunyikan</> : <><Eye size={12} /> Tampilkan</>}
                </button>
                <button onClick={() => setDeleteTarget(f)} className="text-gray-400 hover:text-red-600" title="Hapus">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} masukan</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Kritik & Saran"
        message={`Masukan dari "${deleteTarget?.customer_name}" akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
