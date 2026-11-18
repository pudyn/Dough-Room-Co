"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { publicApi, formatIDR } from "@/lib/api";
import { ArrowLeft, Search, Package, AlertCircle, Clock, MessageCircle } from "lucide-react";

type SavedOrder = { token: string; number: string; date: string };

type PhoneOrder = { order_number: string; access_token: string; customer_name: string; total_amount: number; order_status: string; payment_status: string; created_at: string };

function OrderLookupContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [phoneOrders, setPhoneOrders] = useState<PhoneOrder[]>([]);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);

  const { data: storeData } = useQuery({
    queryKey: ["public-store"],
    queryFn: async () => { const { data } = await publicApi.get("/public/store"); return data.data; },
  });
  const whatsapp = storeData?.settings?.store_whatsapp || storeData?.settings?.store_phone || "";

  useEffect(() => {
    try {
      const last = localStorage.getItem("dr_last_order");
      if (last) {
        const parsed = JSON.parse(last);
        if (Array.isArray(parsed)) setSavedOrders(parsed);
        else if (parsed?.token) setSavedOrders([parsed]);
      }
    } catch {}
  }, []);

  const isPhone = /^0[0-9]{8,13}$/.test(query.trim().replace(/[\s\-+]/g, ""));

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setOrder(null);
    setPhoneOrders([]);
    try {
      if (isPhone) {
        const phone = q.replace(/[\s\-]/g, "");
        const { data } = await publicApi.get("/public/orders/lookup", { params: { phone } });
        const orders = data.data as PhoneOrder[];
        if (orders && orders.length > 0) {
          setPhoneOrders(orders);
        } else {
          setError("Tidak ada pesanan ditemukan untuk nomor ini.");
        }
      } else {
        const { data } = await publicApi.get(`/public/orders/${encodeURIComponent(q)}`);
        setOrder(data.data);
      }
    } catch {
      setError(isPhone ? "Tidak ada pesanan ditemukan untuk nomor ini." : "Pesanan tidak ditemukan. Pastikan kode pesanan benar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-primary-800 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-primary-200 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <img src="/logo.jpg" alt="logo" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h1 className="text-base font-bold leading-tight">Cek Pesanan</h1>
            <p className="text-primary-300 text-xs">doughroom.co Bakehouse Donuts</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Masukkan <strong>nomor HP</strong> atau <strong>kode pesanan</strong> untuk melihat status pesananmu.
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              placeholder="contoh: 081234567890"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5"
            >
              <Search size={16} />
              {loading ? "..." : "Cari"}
            </button>
          </div>
        </div>

        {/* Saved orders from localStorage */}
        {savedOrders.length > 0 && !order && (
          <div className="bg-white rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Clock size={14} className="text-primary-500" /> Pesanan Terakhir</h3>
            {savedOrders.map((s, i) => (
              <button key={i} onClick={() => router.push(`/order/${s.token}`)}
                className="w-full flex items-center justify-between p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-left">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.number}</p>
                  <p className="text-xs text-gray-500">{new Date(s.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="text-primary-600 text-sm font-medium">Lihat →</span>
              </button>
            ))}
          </div>
        )}

        {/* WhatsApp fallback */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <MessageCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-800 font-medium">Lupa kode pesanan?</p>
            <p className="text-xs text-green-700 mt-0.5">Hubungi kami via WhatsApp dengan menyebutkan nama dan tanggal pesananmu.</p>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Halo, saya ingin cek status pesanan saya. Nama: ")}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                <MessageCircle size={12} /> Chat WhatsApp
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Phone lookup results */}
        {phoneOrders.length > 0 && (
          <div className="bg-white rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Package size={14} className="text-primary-500" /> Pesanan ditemukan ({phoneOrders.length})</h3>
            {phoneOrders.map((o) => (
              <button key={o.order_number} onClick={() => router.push(`/order/${o.access_token}`)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-primary-50 rounded-lg transition-colors text-left">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.order_number}</p>
                  <p className="text-xs text-gray-500">{o.customer_name} · {new Date(o.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    o.order_status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    o.order_status === "CANCELLED" || o.order_status === "EXPIRED" ? "bg-red-100 text-red-700" :
                    o.order_status === "READY" ? "bg-green-100 text-green-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{o.order_status}</span>
                  <p className="text-xs font-medium text-gray-900 mt-1">{formatIDR(o.total_amount)}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {order && (
          <div className="bg-white rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900">{(order as Record<string, unknown>).order_number as string}</h2>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                order.order_status === "COMPLETED" ? "bg-green-100 text-green-700" :
                order.order_status === "CANCELLED" || order.order_status === "EXPIRED" ? "bg-red-100 text-red-700" :
                order.order_status === "READY" ? "bg-green-100 text-green-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {order.order_status as string}
              </span>
            </div>

            <div className="text-sm space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Pemesan</span>
                <span className="font-medium text-gray-900">{order.customer_name as string}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal</span>
                <span className="font-medium text-gray-900">{new Date(order.created_at as string).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            </div>

            {Array.isArray(order.items) && (
              <div className="border-t pt-3 space-y-1">
                {(order.items as Array<{ product_name: string; quantity: number; unit_price: number }>).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{formatIDR(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary-600">{formatIDR(order.total_amount as number)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push(`/order/${order.access_token}`)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 text-sm font-bold transition-colors"
            >
              Lihat Detail Pesanan →
            </button>
          </div>
        )}

        <button
          onClick={() => router.push("/menu")}
          className="w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl py-3 text-sm font-medium transition-colors"
        >
          ← Kembali ke Menu
        </button>
      </div>
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-amber-50"><p className="text-gray-500">Memuat...</p></div>}>
      <OrderLookupContent />
    </Suspense>
  );
}
