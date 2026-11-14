"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicApi } from "@/lib/api";
import { ArrowLeft, Upload, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function FeedbackPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Foto maksimal 5MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!message.trim()) { toast.error("Tulis kritik atau saran dulu ya"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("customer_name", name);
      fd.append("contact", contact);
      fd.append("message", message);
      if (file) fd.append("image", file);
      await publicApi.post("/public/feedbacks", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(true);
    } catch {
      toast.error("Gagal mengirim, coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-4 px-6">
        <CheckCircle size={56} className="text-green-500" />
        <h1 className="text-xl font-bold text-gray-900">Terima kasih! 🍩</h1>
        <p className="text-sm text-gray-500 text-center">Kritik & saran kamu sudah kami terima dan akan dibaca langsung oleh pemilik.</p>
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
            <h1 className="text-base font-bold leading-tight">Kritik & Saran</h1>
            <p className="text-primary-200 text-xs">Masukan kamu sangat berarti buat kami</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-xl p-5 space-y-4">
          <div>
            <label className="label text-xs">Nama</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu (boleh kosong)" />
          </div>

          <div>
            <label className="label text-xs">Kontak (No. WA / Email)</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0812xxx / email@contoh.com (opsional)" />
          </div>

          <div>
            <label className="label text-xs">Kritik & Saran *</label>
            <textarea className="input text-sm min-h-32 resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis masukan, kritik, atau saran untuk kami..." />
          </div>

          <div>
            <label className="label text-xs">Foto (opsional)</label>
            <input type="file" accept="image/*" className="hidden" id="feedback-photo" onChange={pickFile} />
            <label htmlFor="feedback-photo" className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors cursor-pointer">
              <Upload size={16} /> {file ? "Ganti Foto" : "Upload Foto"}
            </label>
            {preview && <img src={preview} alt="Preview" className="mt-2 max-h-40 rounded-xl border mx-auto" />}
          </div>

          <button
            onClick={submit}
            disabled={submitting || !message.trim()}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold transition-colors"
          >
            {submitting ? "Mengirim..." : "Kirim"}
          </button>
        </div>
      </div>
    </div>
  );
}
