"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import clsx from "clsx";
import type { Review } from "@/types";

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", page],
    queryFn: async () => {
      const { data } = await api.get("/reviews", { params: { page, per_page: 20 } });
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/reviews/${id}/toggle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Visibilitas review diperbarui");
    },
    onError: () => toast.error("Gagal update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reviews/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review dihapus");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus"),
  });

  const reviews: Review[] = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Review Pelanggan</h1>
      <p className="text-sm text-gray-500">Review yang berstatus &quot;Tampil&quot; akan muncul di halaman menu pelanggan (section Kata Pelanggan).</p>

      {isLoading && <p className="text-gray-400 text-sm">Memuat...</p>}
      {!isLoading && reviews.length === 0 && (
        <div className="card text-center py-10"><p className="text-gray-400 text-sm">Belum ada review</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.map((r) => (
          <div key={r.id} className={clsx("card space-y-2", !r.is_visible && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{r.customer_name}</p>
                <p className="text-amber-400 text-sm">{"★".repeat(r.rating)}<span className="text-gray-200">{"★".repeat(5 - r.rating)}</span></p>
              </div>
              <span className={clsx("badge-status text-[11px]", r.is_visible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
                {r.is_visible ? "Tampil di menu" : "Disembunyikan"}
              </span>
            </div>
            {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
            {r.image_url && (
              <a href={r.image_url} target="_blank" rel="noreferrer">
                <img src={r.image_url} alt="Foto review" className="rounded-lg max-h-40 object-cover border" />
              </a>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleMutation.mutate(r.id)}
                  className={clsx(
                    "text-xs px-2 py-1 rounded border font-medium flex items-center gap-1",
                    r.is_visible ? "border-yellow-200 text-yellow-600 hover:bg-yellow-50" : "border-green-200 text-green-600 hover:bg-green-50"
                  )}
                >
                  {r.is_visible ? <><EyeOff size={12} /> Sembunyikan</> : <><Eye size={12} /> Tampilkan</>}
                </button>
                <button onClick={() => setDeleteTarget(r)} className="text-gray-400 hover:text-red-600" title="Hapus">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {meta.total} review</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
            <span className="px-3 py-1">{page} / {meta.total_pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= meta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Review"
        message={`Review dari "${deleteTarget?.customer_name}" akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
