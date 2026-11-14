"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicApi, formatIDR } from "@/lib/api";
import { Upload, CheckCircle, Clock, ChefHat, Package, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

const statusSteps = [
  { key: "PENDING_PAYMENT", label: "Menunggu Bayar", icon: Clock },
  { key: "CONFIRMED", label: "Dikonfirmasi", icon: CheckCircle },
  { key: "PREPARING", label: "Disiapkan", icon: ChefHat },
  { key: "READY", label: "Siap Ambil", icon: Package },
  { key: "COMPLETED", label: "Selesai", icon: CheckCircle },
];

const stepIndex = (status: string) => statusSteps.findIndex(s => s.key === status);

export default function OrderTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-track", token],
    queryFn: async () => {
      const { data } = await publicApi.get(`/public/orders/${token}`);
      return data.data;
    },
    refetchInterval: 15000,
    enabled: !!token,
  });

  const { data: storeInfo } = useQuery<{ settings?: Record<string, string> }>({
    queryKey: ["public-store"],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/store");
      return data.data;
    },
  });
  const qrisImageUrl = storeInfo?.settings?.qris_image_url || "/qris-gopay.png";

  const cancelMutation = useMutation({
    mutationFn: async () => { await publicApi.post(`/public/orders/${token}/cancel`); },
    onSuccess: () => { toast.success("Pesanan dibatalkan"); qc.invalidateQueries({ queryKey: ["order-track", token] }); },
    onError: () => toast.error("Gagal membatalkan pesanan"),
  });

  async function uploadProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data?.payment?.id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("proof", file);
      await publicApi.post(`/public/payments/${data.payment.id}/proof`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Bukti pembayaran dikirim");
      qc.invalidateQueries({ queryKey: ["order-track", token] });
    } catch { toast.error("Gagal upload bukti"); }
    finally { setUploading(false); }
  }

  if (isLoading) return <div className="min-h-screen bg-amber-50 flex items-center justify-center"><p className="text-gray-500">Memuat...</p></div>;
  if (error || !data) return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-3">
      <AlertCircle size={48} className="text-red-400" />
      <p className="text-gray-600">Pesanan tidak ditemukan</p>
    </div>
  );

  const order = data;
  const isCancelled = ["CANCELLED","EXPIRED"].includes(order.order_status);
  const currentStep = stepIndex(order.order_status);

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-primary-800 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src="/logo.jpg" alt="logo" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          <div>
            <h1 className="text-base font-bold leading-tight">Status Pesanan</h1>
            <p className="text-primary-200 text-xs font-mono">{order.order_number}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status tracker */}
        {!isCancelled ? (
          <div className="bg-white rounded-xl p-5">
            <div className="relative">
              <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-gray-200"></div>
              <div className="relative grid grid-cols-5">
                {statusSteps.slice(0, 5).map((step, i) => {
                  const Icon = step.icon;
                  const done = i <= currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-2">
                      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors", done ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-400", active && "ring-4 ring-primary-100")}>
                        <Icon size={18} />
                      </div>
                      <span className={clsx("text-[10px] leading-tight text-center w-full break-words", done ? "text-primary-700 font-medium" : "text-gray-400")}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
            <XCircle size={32} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">{order.order_status === "CANCELLED" ? "Pesanan Dibatalkan" : "Pesanan Kadaluarsa"}</p>
              <p className="text-sm text-red-600">Pembayaran tidak diterima dalam batas waktu</p>
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Detail Pesanan</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-gray-600"><span>Pemesan</span><span className="font-medium text-gray-900">{order.customer_name}</span></div>
            {order.customer_phone && <div className="flex justify-between text-gray-600"><span>WhatsApp</span><span className="font-medium text-gray-900">{order.customer_phone}</span></div>}
            {order.pickup_date && <div className="flex justify-between text-gray-600"><span>Ambil</span><span className="font-medium text-gray-900">{new Date(order.pickup_date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</span></div>}
          </div>
          <div className="border-t pt-3 space-y-1">
            {(order.items ?? []).map((item: { product_name: string; quantity: number; unit_price: number }, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                <span className="font-medium">{formatIDR(item.unit_price * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary-600">{formatIDR(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment info */}
        {order.payment && !isCancelled && (
          <div className="bg-white rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Pembayaran</h2>
              <span className={clsx("text-xs px-2 py-1 rounded-full font-medium", order.payment.payment_status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{order.payment.payment_status}</span>
            </div>

            {(order.payment.payment_method === "BANK_TRANSFER" || order.payment.payment_method === "QRIS") && order.payment.payment_status !== "PAID" && order.order_status === "PENDING_PAYMENT" && (
              <>
                {order.payment.payment_method === "BANK_TRANSFER" ? (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-medium mb-1">Transfer ke:</p>
                    <p className="font-bold text-gray-900">{order.payment.bank_name}</p>
                    <p className="font-mono font-bold text-lg text-gray-900">{order.payment.account_number}</p>
                    <p className="text-sm text-gray-600">{order.payment.account_name}</p>
                    <p className="text-primary-600 font-bold mt-2">{formatIDR(order.payment.amount)}</p>
                    {order.payment.expired_at && (
                      <p className="text-xs text-red-500 mt-1">Bayar sebelum: {new Date(order.payment.expired_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-blue-700 font-medium">Scan atau simpan QR ini, lalu bayar dengan:</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 mb-3">GoPay · OVO · DANA · ShopeePay · m-banking</p>
                    <div className="inline-block bg-white rounded-2xl p-3 shadow-sm border border-blue-100">
                      <img src={qrisImageUrl} alt="QRIS Doughroom" className="w-56 max-w-full rounded-lg" />
                    </div>
                    <p className="text-primary-600 font-bold text-lg mt-3">{formatIDR(order.payment.amount)}</p>
                    {order.payment.expired_at && (
                      <p className="text-xs text-red-500 mt-1">Bayar sebelum: {new Date(order.payment.expired_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                    )}
                    <a href={qrisImageUrl} download="QRIS-Doughroom.png"
                      className="mt-3 inline-flex items-center justify-center gap-1.5 w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
                      ⬇ Simpan Gambar QR
                    </a>
                    <p className="text-[11px] text-gray-500 mt-2">Dari HP: buka aplikasi e-wallet → <strong>Scan</strong> → pilih gambar QR dari galeri</p>
                  </div>
                )}

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadProof} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors">
                  <Upload size={16} />
                  {uploading ? "Mengunggah..." : order.payment.proof_url ? "Ganti Bukti Pembayaran" : "Upload Bukti Pembayaran"}
                </button>
                {order.payment.proof_url && (
                  <div className="text-center">
                    <img src={order.payment.proof_url} alt="Bukti" className="max-h-32 mx-auto rounded-lg border" />
                    <p className="text-xs text-green-600 mt-1">✓ Bukti diterima, menunggu konfirmasi</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Cancel button */}
        {order.order_status === "PENDING_PAYMENT" && (
          <button onClick={() => { if (confirm("Batalkan pesanan?")) cancelMutation.mutate(); }}
            disabled={cancelMutation.isPending}
            className="w-full border border-red-200 text-red-600 hover:bg-red-50 rounded-xl py-3 text-sm font-medium transition-colors">
            Batalkan Pesanan
          </button>
        )}

        {/* Back to menu */}
        <button onClick={() => router.push("/menu")}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 text-sm font-bold transition-colors">
          ← Kembali ke Menu
        </button>
      </div>
    </div>
  );
}
