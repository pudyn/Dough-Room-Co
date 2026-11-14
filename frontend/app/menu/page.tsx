"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { publicApi, formatIDR } from "@/lib/api";
import { useCart } from "@/hooks/useCart";
import { ShoppingCart, Search, Plus, Minus, MapPin, Phone, Star } from "lucide-react";
import clsx from "clsx";
import type { Product, Review } from "@/types";

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qr") ?? "";
  const { items, addItem, updateQty } = useCart();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data: storeData } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => { const { data } = await publicApi.get("/public/store"); return data.data; },
  });

  const settings = storeData?.settings;

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/menu", { params: { per_page: 100 } });
      const products = data.data as Product[];
      const seen = new Set<string>();
      return products.reduce((acc: { id: string; name: string }[], p) => {
        if (p.category_id && p.category_name && !seen.has(p.category_id)) {
          seen.add(p.category_id);
          acc.push({ id: p.category_id, name: p.category_name });
        }
        return acc;
      }, []);
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["public-products", search, categoryId],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/menu", {
        params: { search, category_id: categoryId || undefined, per_page: 100 },
      });
      return data.data as Product[];
    },
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/reviews");
      return data.data ?? [];
    },
  });

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  function getQty(productId: string) {
    return items.find(i => i.productId === productId)?.quantity ?? 0;
  }

  const activeProducts = (products ?? []).filter(p => p.is_active);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-100 via-amber-50 to-cream-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-2xl mx-auto px-4 pt-6 pb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src="/logo.jpg" alt="doughroom.co" className="w-16 h-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/20" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-primary-800" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white tracking-tight">{settings?.store_name ?? "doughroom.co"}</h1>
              <p className="text-primary-200 text-sm font-medium">{settings?.store_tagline ?? "Bakehouse Donuts"}</p>
              {settings?.store_address && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={11} className="text-primary-300" />
                  <p className="text-primary-300 text-xs">{settings.store_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Search integrated in header */}
          <div className="mt-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/95 backdrop-blur-sm border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm placeholder-gray-400"
              placeholder="Cari menu favoritmu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-32 -mt-1">
        {/* Categories */}
        <div className="sticky top-0 bg-gradient-to-b from-cream-100 to-cream-100/95 backdrop-blur-md py-3 z-10">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoryId("")}
              className={clsx(
                "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm",
                !categoryId
                  ? "bg-primary-600 text-white shadow-primary-200"
                  : "bg-white text-gray-600 hover:bg-primary-50 hover:text-primary-700 border border-gray-100"
              )}
            >
              🍩 Semua
            </button>
            {(categories ?? []).map((c: { id: string; name: string }) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={clsx(
                  "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm",
                  categoryId === c.id
                    ? "bg-primary-600 text-white shadow-primary-200"
                    : "bg-white text-gray-600 hover:bg-primary-50 hover:text-primary-700 border border-gray-100"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-2 text-primary-400">
              <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Memuat menu...</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-2">
          {activeProducts.map(p => {
            const qty = getQty(p.id);
            const outOfStock = p.stock_tracking && p.stock_quantity <= 0;
            const lowStock = p.stock_tracking && p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold;

            return (
              <div
                key={p.id}
                className={clsx(
                  "bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100/80 transition-all",
                  qty > 0 && "ring-2 ring-primary-400 shadow-md",
                  outOfStock && "opacity-50 grayscale"
                )}
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-gradient-to-br from-cream-100 to-cream-200 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl opacity-60">🍩</span>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {p.is_recommended && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow">🔥 HOT</span>
                    )}
                    {p.sales_modes?.includes("PREORDER") && !p.sales_modes?.includes("READY_STOCK") && (
                      <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">PRE-ORDER</span>
                    )}
                    {outOfStock && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">HABIS</span>
                    )}
                    {lowStock && (
                      <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">SISA {p.stock_quantity}</span>
                    )}
                  </div>

                  {/* Qty badge */}
                  {qty > 0 && (
                    <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
                      {qty}
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                  {p.description && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-2.5">
                    <p className="text-primary-700 font-bold text-sm">{formatIDR(p.selling_price)}</p>

                    {outOfStock ? (
                      <span className="text-[10px] text-red-400 font-medium">Stok habis</span>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => addItem({ productId: p.id, name: p.name, price: p.selling_price, imageUrl: p.image_url ?? undefined, salesModes: p.sales_modes ?? [] })}
                        className="w-8 h-8 rounded-xl bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center transition-colors shadow-sm active:scale-95"
                      >
                        <Plus size={16} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(p.id, -1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all">
                          <Minus size={13} />
                        </button>
                        <span className="font-bold text-gray-900 w-5 text-center text-sm">{qty}</span>
                        <button
                          onClick={() => { if (p.stock_tracking && qty >= p.stock_quantity) return; updateQty(p.id, 1); }}
                          disabled={p.stock_tracking && qty >= p.stock_quantity}
                          className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center hover:bg-primary-200 text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {!isLoading && activeProducts.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <span className="text-5xl">🔍</span>
            <p className="text-gray-400 text-sm">Tidak ada menu yang ditemukan</p>
          </div>
        )}

        {/* Kata Pelanggan (reviews) */}
        {(reviews ?? []).length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-primary-800 flex items-center gap-1.5"><Star size={16} className="fill-amber-400 text-amber-400" /> Kata Pelanggan</h2>
              <span className="text-xs text-gray-400">{(reviews ?? []).length} ulasan</span>
            </div>
            {(reviews ?? []).slice(0, 5).map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/80">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900">{r.customer_name}</span>
                  <span className="text-sm text-amber-400">{"★".repeat(r.rating)}<span className="text-gray-200">{"★".repeat(5 - r.rating)}</span></span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                {r.image_url && <img src={r.image_url} alt="Foto review" className="mt-2 rounded-xl max-h-40 object-cover" />}
                <p className="text-[11px] text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            ))}
          </div>
        )}

        {/* Review & feedback links */}
        <div className="mt-8 flex gap-2">
          <button
            onClick={() => router.push("/review")}
            className="flex-1 bg-white border border-gray-200 rounded-2xl py-3 text-sm font-medium text-gray-700 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-1.5"
          >
            ⭐ Beri Review
          </button>
          <button
            onClick={() => router.push("/feedback")}
            className="flex-1 bg-white border border-gray-200 rounded-2xl py-3 text-sm font-medium text-gray-700 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-1.5"
          >
            💬 Kritik & Saran
          </button>
        </div>
      </div>

      {/* Floating cart */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-20">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => router.push(`/checkout?qr=${qrCode}`)}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-xl shadow-primary-900/20 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl w-8 h-8 flex items-center justify-center">
                  <ShoppingCart size={16} />
                </div>
                <div className="text-left">
                  <span className="font-bold text-sm">{totalItems} item</span>
                  <p className="text-primary-200 text-xs">Lihat Keranjang</p>
                </div>
              </div>
              <span className="font-bold text-lg">{formatIDR(totalAmount)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return <Suspense fallback={
    <div className="flex items-center justify-center min-h-screen bg-cream-50">
      <div className="text-center space-y-3">
        <span className="text-5xl">🍩</span>
        <p className="text-primary-400 text-sm font-medium">Memuat menu...</p>
      </div>
    </div>
  }><MenuContent /></Suspense>;
}
