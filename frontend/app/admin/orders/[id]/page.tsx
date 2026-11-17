"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { ArrowLeft, Upload, CheckCircle, XCircle, Printer, Bluetooth, Monitor } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { printReceipt, checkAgent, bluetoothSupported } from "@/lib/printer";

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PREPARING: "bg-indigo-50 text-indigo-700",
  READY: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-50 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
  EXPIRED: "bg-gray-50 text-gray-400",
};

const nextStatuses: Record<string, string[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null);
  const [hasBluetooth, setHasBluetooth] = useState(false);

  useEffect(() => {
    setHasBluetooth(bluetoothSupported());
    checkAgent().then(setPrinterOnline);
    const interval = setInterval(() => checkAgent().then(setPrinterOnline), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => { const { data } = await api.get(`/orders/${id}`); return data.data; },
    enabled: !!id,
  });

  const { data: storeSettings } = useQuery<Record<string, string>>({
    queryKey: ["store-settings"],
    queryFn: async () => {
      try { const { data } = await api.get("/public/store"); return data.data; }
      catch { return {}; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => { await api.patch(`/orders/${id}/status`, { status }); },
    onSuccess: () => { toast.success("Status diperbarui"); qc.invalidateQueries({ queryKey: ["order", id] }); },
    onError: () => toast.error("Gagal update status"),
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, action }: { paymentId: string; action: "verify" | "reject" }) => {
      if (action === "verify") await api.post(`/payments/${paymentId}/verify`);
      else await api.post(`/payments/${paymentId}/reject`);
    },
    onSuccess: () => { toast.success("Pembayaran diperbarui"); qc.invalidateQueries({ queryKey: ["order", id] }); },
    onError: () => toast.error("Gagal update pembayaran"),
  });

  async function uploadProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data?.payment?.id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("proof", file);
      await api.post(`/payments/${data.payment.id}/proof`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Bukti diunggah");
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch { toast.error("Gagal upload"); }
    finally { setUploading(false); }
  }

  if (isLoading) return <div className="p-6 text-gray-400">Memuat...</div>;
  if (!data) return <div className="p-6 text-gray-400">Pesanan tidak ditemukan</div>;

  const order = data;
  const allowedNext = nextStatuses[order.order_status] ?? [];

  async function handlePrintReceipt() {
    try {
      const result = await printReceipt({
        storeName: storeSettings?.store_name || "doughroom.co",
        storeAddress: storeSettings?.store_address || "",
        orderNumber: order.order_number ?? "-",
        createdAt: order.created_at ?? new Date().toISOString(),
        items: (order.items ?? []).map((it: { product_name: string; quantity: number; unit_price: number }) => ({
          name: it.product_name,
          quantity: it.quantity,
          price: it.unit_price,
        })),
        subtotal: (order.items ?? []).reduce((sum: number, it: { unit_price: number; quantity: number }) => sum + it.unit_price * it.quantity, 0),
        discount: order.discount_amount ?? 0,
        promoCode: order.promo_code,
        total: order.total_amount,
        paymentMethod: order.payment?.payment_method ?? "CASH",
        footer: `--- ${storeSettings?.store_name || "doughroom.co"} ---`,
      });
      if (result.via === "agent") toast.success("Struk tercetak");
      else if (result.via === "bluetooth") toast.success("Struk tercetak via Bluetooth");
      else toast.info("Struk dibuka di dialog cetak browser");
    } catch {
      toast.error("Gagal mencetak struk");
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
          <span className={clsx("badge-status text-xs", statusColors[order.order_status])}>{order.order_status}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={handlePrintReceipt} className="btn-secondary text-sm flex items-center gap-1.5">
            <Printer size={16} /> Cetak Struk
          </button>
          <div className="flex flex-col items-end gap-0.5">
            <span className={clsx("flex items-center gap-1 text-xs",
              printerOnline === null ? "text-gray-400" : printerOnline ? "text-green-600" : "text-red-500"
            )}>
              <Monitor size={12} />
              <span className={clsx("w-1.5 h-1.5 rounded-full",
                printerOnline === null ? "bg-gray-400" : printerOnline ? "bg-green-500" : "bg-red-400"
              )} />
              {printerOnline === null ? "Agent: cek..." : printerOnline ? "Agent: terhubung" : "Agent: offline"}
            </span>
            <span className={clsx("flex items-center gap-1 text-xs",
              hasBluetooth ? "text-blue-600" : "text-gray-400"
            )}>
              <Bluetooth size={12} />
              <span className={clsx("w-1.5 h-1.5 rounded-full",
                hasBluetooth ? "bg-blue-500" : "bg-gray-400"
              )} />
              {hasBluetooth ? "Bluetooth: tersedia" : "Bluetooth: tidak didukung"}
            </span>
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="card space-y-2 text-sm">
        <h2 className="font-semibold text-gray-900">Info Pelanggan</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
          <span>Nama</span><span className="font-medium text-gray-900">{order.customer_name ?? "Walk-in"}</span>
          {order.customer_phone && <><span>WhatsApp</span><span className="font-medium text-gray-900">{order.customer_phone}</span></>}
          {order.pickup_date && <><span>Ambil</span><span className="font-medium text-gray-900">{new Date(order.pickup_date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</span></>}
          <span>Sumber</span><span className="font-medium text-gray-900">{order.source}</span>
          <span>Dibuat</span><span className="font-medium text-gray-900">{new Date(order.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span>
        </div>
        {order.notes && <p className="text-gray-500 italic text-xs mt-1">Catatan: {order.notes}</p>}
      </div>

      {/* Order items */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Item Pesanan</h2>
        <div className="space-y-2">
          {(order.items ?? []).map((item: { product_name: string; quantity: number; unit_price: number; subtotal: number }, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <div>
                <span className="font-medium text-gray-900">{item.product_name}</span>
                <span className="text-gray-500 ml-2">× {item.quantity}</span>
              </div>
              <span className="font-medium">{formatIDR(item.subtotal ?? item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary-600">{formatIDR(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      {order.payment && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pembayaran</h2>
            <span className={clsx("badge-status text-xs",
              order.payment.payment_status === "PAID" ? "bg-green-50 text-green-700" :
              order.payment.payment_status === "PENDING" ? "bg-yellow-50 text-yellow-700" :
              "bg-gray-100 text-gray-500"
            )}>{order.payment.payment_status}</span>
          </div>
          <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
            <span>Metode</span><span className="font-medium text-gray-900">{order.payment.payment_method}</span>
            <span>Jumlah</span><span className="font-medium text-gray-900">{formatIDR(order.payment.amount)}</span>
            {order.payment.expired_at && <><span>Kadaluarsa</span><span className="font-medium text-gray-900">{new Date(order.payment.expired_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span></>}
          </div>
          {order.payment.proof_url && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Bukti Transfer:</p>
              <img src={order.payment.proof_url} alt="Bukti" onClick={() => setLightbox(true)}
                className="max-h-48 rounded-lg border w-auto cursor-pointer hover:opacity-80 transition-opacity" />
            </div>
          )}
          {order.payment.payment_status === "PENDING" && (
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadProof} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm flex items-center gap-1">
                <Upload size={14} /> {uploading ? "Upload..." : "Upload Bukti"}
              </button>
              {order.payment.proof_url && (
                <>
                  <button onClick={() => verifyPaymentMutation.mutate({ paymentId: order.payment.id, action: "verify" })}
                    disabled={verifyPaymentMutation.isPending}
                    className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium">
                    <CheckCircle size={14} /> Verifikasi
                  </button>
                  <button onClick={() => verifyPaymentMutation.mutate({ paymentId: order.payment.id, action: "reject" })}
                    disabled={verifyPaymentMutation.isPending}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium">
                    <XCircle size={14} /> Tolak
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status actions */}
      {allowedNext.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Update Status</h2>
          <div className="flex gap-2 flex-wrap">
            {allowedNext.map(s => (
              <button key={s} onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending}
                className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  s === "CANCELLED" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                  s === "CONFIRMED" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                  s === "PREPARING" ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" :
                  s === "READY" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                  "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}>
                → {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {lightbox && order.payment?.proof_url && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={order.payment.proof_url} alt="Bukti Transfer" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
