"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api";
import { ArrowLeft, Star, Upload, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import type { Review } from "@/types";

export default function ReviewPage() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/reviews");
      return data.data ?? [];
    },
  });

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Foto maksimal 5MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (rating < 1) { toast.error("Pilih jumlah bintang dulu ya"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("customer_name", name);
      fd.append("rating", String(rating));
      fd.append("comment", comment);
      if (file) fd.append("image", file);
      await publicApi.post("/public/reviews", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(true);
    } catch {
      toast.error("Gagal mengirim review, coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-4 px-6">
        <CheckCircle size={56} className="text-green-500" />
        <h1 className="text-xl font-bold text-gray-900">Terima kasih! 🍩</h1>
        <p className="text-sm text-gray-500 text-center">Review kamu sudah terkirim dan akan tampil di halaman menu.</p>
        <button onClick={() => router.push("/menu")} className="mt-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 px-8 text-sm font-bold transition-colors">
          ← Kembali ke Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="bg-primary-800 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/menu")} className="text-primary-200 hover:text-white"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-base font-bold leading-tight">Beri Review</h1>
            <p className="text-primary-200 text-xs">Bagaimana pengalaman kamu?</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-5 space-y-4">
          {/* Stars */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Penilaian *</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="transition-transform active:scale-90">
                  <Star size={36} className={clsx(n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                </button>
              ))}
            </div>
            {rating > 0 && <p className="text-xs text-gray-400 mt-1">{["", "Sangat kurang", "Kurang", "Cukup", "Bagus", "Sangat bagus"][rating]}</p>}
          </div>

          <div>
            <label className="label text-xs">Nama</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu (boleh kosong)" />
          </div>

          <div>
            <label className="label text-xs">Komentar</label>
            <textarea className="input text-sm min-h-24 resize-none" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ceritakan pengalaman kamu..." />
          </div>

          <div>
            <label className="label text-xs">Foto (opsional)</label>
            <input type="file" accept="image/*" className="hidden" id="review-photo" onChange={pickFile} />
            <label htmlFor="review-photo" className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors cursor-pointer">
              <Upload size={16} /> {file ? "Ganti Foto" : "Upload Foto"}
            </label>
            {preview && <img src={preview} alt="Preview" className="mt-2 max-h-40 rounded-xl border mx-auto" />}
          </div>

          <button
            onClick={submit}
            disabled={submitting || rating < 1}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold transition-colors"
          >
            {submitting ? "Mengirim..." : "Kirim Review"}
          </button>
        </div>

        {/* Recent reviews */}
        {(reviews ?? []).length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">Ulasan Terbaru</h2>
            {(reviews ?? []).slice(0, 10).map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900">{r.customer_name}</span>
                  <span className="text-amber-400 text-sm">{"★".repeat(r.rating)}<span className="text-gray-200">{"★".repeat(5 - r.rating)}</span></span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                {r.image_url && <img src={r.image_url} alt="Foto review" className="mt-2 rounded-lg max-h-40 object-cover" />}
                <p className="text-[11px] text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
