"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { publicApi, formatIDR } from "@/lib/api";
import { ArrowLeft, Search, Package, AlertCircle } from "lucide-react";

function OrderLookupContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const { data } = await publicApi.get(`/public/orders/${encodeURIComponent(q)}`);
      setOrder(data.data);
    } catch {
      setError("Pesanan tidak ditemukan. Pastikan kode pesanan benar.");
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
            Masukkan kode pesanan yang kamu dapat setelah checkout untuk melihat status pesananmu.
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              placeholder="Kode pesanan..."
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
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
