"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { publicApi, formatIDR } from "@/lib/api";
import { todayJakarta } from "@/lib/date";
import { useCart } from "@/hooks/useCart";
import { ArrowLeft, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type BankAccount = { id: string; bank_name: string; account_number: string; account_holder: string };

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qr") ?? "";
  const { items, clearCart } = useCart();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", pickup_date: "", notes: "", payment_method: "BANK_TRANSFER" });
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ promo_id: string; code: string; name: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState("");

  const { data: banks } = useQuery<BankAccount[]>({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/store");
      return data.data?.bank_accounts ?? [];
    },
  });

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = promoResult?.discount ?? 0;
  const total = subtotal - discount;

  async function validatePromo() {
    if (!promoCode.trim()) return;
    setPromoError("");
    setPromoResult(null);
    try {
      const { data } = await publicApi.post("/public/promos/validate", { code: promoCode.trim(), order_amount: subtotal });
      setPromoResult(data.data);
      toast.success(`Promo "${data.data.code}" berlaku!`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Kode promo tidak valid";
      setPromoError(msg);
      toast.error(msg);
    }
  }

  // If ANY item is PREORDER-only (no READY_STOCK mode), treat the whole order as PREORDER
  const orderType = items.some(
    i => i.salesModes.length > 0 && i.salesModes.includes("PREORDER") && !i.salesModes.includes("READY_STOCK")
  ) ? "PREORDER" : "READY_STOCK";

  const orderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await publicApi.post("/public/orders", {
        order_type: orderType,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || undefined,
        pickup_date: form.pickup_date || undefined,
        notes: form.notes || undefined,
        payment_method: form.payment_method,
        promo_code_id: promoResult?.promo_id || undefined,
        qr_code: qrCode || undefined,
        items: items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
      });
      return data.data;
    },
    onSuccess: (order) => {
      clearCart();
      router.push(`/order/${order.access_token}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Gagal membuat pesanan. Coba lagi.");
    },
  });

  function copyAccount(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Nomor rekening disalin");
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-4">
        <span className="text-5xl">🛒</span>
        <p className="text-gray-600">Keranjang kosong</p>
        <button onClick={() => router.push(`/menu?qr=${qrCode}`)} className="bg-primary-500 text-white px-6 py-2 rounded-xl font-medium">Lihat Menu</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-primary-800 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-primary-200 hover:text-white"><ArrowLeft size={20} /></button>
          <img src="/logo.jpg" alt="logo" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h1 className="text-base font-bold leading-tight">Checkout</h1>
            <p className="text-primary-300 text-xs">doughroom.co Bakehouse Donuts</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Order summary */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pesananmu</h2>
            {orderType === "PREORDER" && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Pre-Order</span>
            )}
          </div>
          {items.map(item => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.name} × {item.quantity}</span>
              <span className="font-medium">{formatIDR(item.price * item.quantity)}</span>
            </div>
          ))}
          {discount > 0 && (
            <>
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatIDR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Diskon ({promoResult?.code})</span>
                <span>-{formatIDR(discount)}</span>
              </div>
            </>
          )}
          <div className={`${discount > 0 ? "" : "border-t pt-3"} flex justify-between font-bold`}>
            <span>Total</span>
            <span className="text-primary-600">{formatIDR(total)}</span>
          </div>
        </div>

        {/* Promo code */}
        <div className="bg-white rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-gray-900">Kode Promo</h2>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Masukkan kode promo"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
            />
            <button
              type="button"
              onClick={validatePromo}
              className="btn-primary px-4 text-sm whitespace-nowrap"
            >
              Pakai
            </button>
          </div>
          {promoError && <p className="text-xs text-red-500">{promoError}</p>}
          {promoResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">{promoResult.name}</p>
                <p className="text-xs text-green-600">Diskon {formatIDR(promoResult.discount)}</p>
              </div>
              <button onClick={() => { setPromoResult(null); setPromoCode(""); }} className="text-green-400 hover:text-green-600 text-xs">Hapus</button>
            </div>
          )}
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Data Pemesan</h2>
          <div>
            <label className="label text-xs">Nama *</label>
            <input className="input" required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nama kamu" />
          </div>
          <div>
            <label className="label text-xs">No. WhatsApp *</label>
            <input className="input" required value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="08xxx" type="tel" />
          </div>
          <div>
            <label className="label text-xs">Email</label>
            <input className="input" type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="email@contoh.com (opsional)" />
          </div>
          <div>
            <label className="label text-xs">Tanggal Ambil</label>
            <input className="input" type="date" value={form.pickup_date} min={todayJakarta()} onChange={e => setForm(f => ({ ...f, pickup_date: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Catatan</label>
            <textarea className="input text-sm min-h-16 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan khusus..." />
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Pembayaran</h2>
          <div className="space-y-2">
            {[
              { value: "BANK_TRANSFER", label: "Transfer Bank", desc: "BCA Transfer" },
              { value: "PAY_AT_COUNTER", label: "Bayar di Kasir", desc: "Bayar saat ambil" },
            ].map(m => (
              <label key={m.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.payment_method === m.value ? "border-primary-400 bg-primary-50" : "border-gray-200"}`}>
                <input type="radio" name="payment" value={m.value} checked={form.payment_method === m.value} onChange={() => setForm(f => ({ ...f, payment_method: m.value }))} className="accent-primary-500" />
                <div>
                  <p className="font-medium text-sm text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Bank info */}
        {form.payment_method === "BANK_TRANSFER" && (banks ?? []).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Informasi Rekening</p>
            {(banks ?? []).map(b => (
              <div key={b.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{b.bank_name}</p>
                  <p className="text-xs text-gray-600">{b.account_holder}</p>
                  <p className="font-mono font-bold text-gray-900">{b.account_number}</p>
                </div>
                <button onClick={() => copyAccount(b.account_number)} className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200">
                  {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} className="text-blue-600" />}
                </button>
              </div>
            ))}
            <p className="text-xs text-blue-700 mt-2">Transfer sebesar <strong>{formatIDR(Math.max(0, total))}</strong> dan upload bukti di halaman pesanan. Batas waktu 60 menit.</p>
          </div>
        )}
      </div>

      {/* Fixed submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => {
              if (!form.customer_name || !form.customer_phone) { toast.error("Isi nama dan nomor WhatsApp"); return; }
              orderMutation.mutate();
            }}
            disabled={orderMutation.isPending}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl py-4 font-bold text-base transition-colors">
            {orderMutation.isPending ? "Memproses..." : `Pesan Sekarang · ${formatIDR(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Memuat...</div>}><CheckoutContent /></Suspense>;
}
