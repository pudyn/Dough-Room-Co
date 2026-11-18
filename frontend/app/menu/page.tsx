"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { publicApi, formatIDR } from "@/lib/api";
import { useCart } from "@/hooks/useCart";
import { groupProducts, calculatePrice, getGroupQty, formatBreakdown, type ProductGroup } from "@/lib/productTiers";
import { ShoppingCart, Search, Plus, Minus, MapPin, Star, X, Instagram, AtSign } from "lucide-react";
import clsx from "clsx";
import type { Product, Review } from "@/types";

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qr") ?? "";
  const { items, setGroupItems } = useCart();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [detailGroup, setDetailGroup] = useState<ProductGroup | null>(null);
  const [popupQty, setPopupQty] = useState(0);
  const [lastOrder, setLastOrder] = useState<{ token: string; number: string; date: string } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("dr_last_order");
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) setLastOrder(parsed[0]);
        else if (parsed?.token) setLastOrder(parsed);
      }
    } catch {}
  }, []);

  useQuery({
    queryKey: ["qr-track", qrCode],
    enabled: !!qrCode,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data } = await publicApi.get(`/public/qr/${qrCode}`);
      return data.data;
    },
  });

  const { data: storeData } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => { const { data } = await publicApi.get("/public/store"); return data.data; },
  });

  const settings = storeData?.settings;

  const { data: products, isLoading } = useQuery({
    queryKey: ["public-products", categoryId],
    queryFn: async () => {
      const { data } = await publicApi.get("/public/menu", {
        params: { category_id: categoryId || undefined, per_page: 100 },
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

  const categories = useMemo(() => {
    if (!products) return [];
    const seen = new Set<string>();
    return products.reduce((acc: { id: string; name: string }[], p) => {
      if (p.category_id && p.category_name && !seen.has(p.category_id)) {
        seen.add(p.category_id);
        acc.push({ id: p.category_id, name: p.category_name });
      }
      return acc;
    }, []);
  }, [products]);

  const activeProducts = useMemo(
    () => (products ?? []).filter((p) => p.is_active),
    [products]
  );

  const productGroups = useMemo(
    () => {
      const groups = groupProducts(activeProducts).filter((g) => g.isActive);
      if (!search.trim()) return groups;
      const q = search.toLowerCase();
      return groups.filter((g) => g.displayName.toLowerCase().includes(q));
    },
    [activeProducts, search]
  );

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  function openGroupDetail(group: ProductGroup) {
    const currentQty = getGroupQty(items, group);
    setPopupQty(currentQty || 1);
    setDetailGroup(group);
  }

  function confirmAddGroup() {
    if (!detailGroup || popupQty <= 0) return;
    const p = detailGroup.product;
    const totalPrice = calculatePrice(detailGroup, popupQty);
    const effectiveUnitPrice = Math.round(totalPrice / popupQty);
    const groupProductIds = [p.id];
    const newItems = [{
      productId: p.id,
      name: p.name,
      price: effectiveUnitPrice,
      imageUrl: p.image_url ?? undefined,
      quantity: popupQty,
      salesModes: p.sales_modes ?? ["READY_STOCK"],
    }];
    setGroupItems(groupProductIds, newItems);
    setDetailGroup(null);
  }

  function removeGroup() {
    if (!detailGroup) return;
    setGroupItems([detailGroup.product.id], []);
    setDetailGroup(null);
  }

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
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <a href="https://instagram.com/doughroom.co" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-200 hover:text-white text-xs transition-colors">
                  <Instagram size={13} /> @doughroom.co
                </a>
                <span className="text-primary-500">•</span>
                <a href="https://www.threads.net/@doughroom.co" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-200 hover:text-white text-xs transition-colors">
                  <AtSign size={13} /> Threads
                </a>
                <span className="text-primary-500">•</span>
                <button onClick={() => router.push("/review")} className="flex items-center gap-1 text-primary-200 hover:text-white text-xs transition-colors">
                  ⭐ Ulasan
                </button>
                <span className="text-primary-500">•</span>
                <button onClick={() => router.push("/feedback")} className="flex items-center gap-1 text-primary-200 hover:text-white text-xs transition-colors">
                  💬 Kritik & Saran
                </button>
                <span className="text-primary-500">•</span>
                <button onClick={() => router.push("/order-lookup")} className="flex items-center gap-1 text-primary-200 hover:text-white text-xs transition-colors">
                  📦 Cek Pesanan
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/95 backdrop-blur-sm border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm placeholder-gray-400"
              placeholder="Cari menu favoritmu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-32 -mt-1">
        {/* Last order banner */}
        {lastOrder && (
          <button
            onClick={() => router.push(`/order/${lastOrder.token}`)}
            className="w-full mb-3 bg-white border border-primary-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm hover:border-primary-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-primary-500">📦</span>
              <span className="text-gray-600">Pesanan terakhir: <span className="font-semibold text-gray-900">{lastOrder.number}</span></span>
            </div>
            <span className="text-primary-600 text-xs font-semibold">Lihat Status →</span>
          </button>
        )}

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
            {categories.map((c) => (
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

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-2 text-primary-400">
              <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Memuat menu...</span>
            </div>
          </div>
        )}

        {/* Product Groups Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {productGroups.map((group) => {
            const qty = getGroupQty(items, group);
            const outOfStock = group.stockTracking && group.stockQuantity <= 0;

            return (
              <div
                key={group.key}
                onClick={() => !outOfStock && openGroupDetail(group)}
                className={clsx(
                  "bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100/80 transition-all cursor-pointer",
                  qty > 0 && "ring-2 ring-primary-400 shadow-md",
                  outOfStock && "opacity-50 grayscale"
                )}
              >
                <div className="relative aspect-square bg-gradient-to-br from-cream-100 to-cream-200 overflow-hidden">
                  {group.imageUrl ? (
                    <img src={group.imageUrl} alt={group.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl opacity-60">{group.isCombo ? "🎁" : "🍩"}</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {group.isRecommended && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow">🔥 HOT</span>
                    )}
                    {group.isCombo && (
                      <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">PAKET</span>
                    )}
                    {outOfStock && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">HABIS</span>
                    )}
                  </div>

                  {qty > 0 && (
                    <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
                      {qty}
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{group.displayName}</h3>
                  <div className="flex items-center justify-between mt-2.5">
                    <div>
                      <p className="text-primary-700 font-bold text-sm">{formatIDR(group.basePrice)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">@{group.isCombo ? "set" : "pcs"}</span></p>
                    </div>
                    {!outOfStock && (
                      <div className="w-8 h-8 rounded-xl bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center transition-colors shadow-sm active:scale-95">
                        <Plus size={16} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {!isLoading && productGroups.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <span className="text-5xl">🔍</span>
            <p className="text-gray-400 text-sm">Tidak ada menu yang ditemukan</p>
          </div>
        )}

        {/* Reviews */}
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

      </div>

      {/* Quantity popup */}
      {detailGroup && (() => {
        const price = calculatePrice(detailGroup, popupQty);
        const breakdown = formatBreakdown(detailGroup, popupQty);
        const currentQty = getGroupQty(items, detailGroup);
        const unit = detailGroup.isCombo ? "set" : "pcs";
        const totalPcs = detailGroup.isCombo ? popupQty * detailGroup.piecesPerUnit : popupQty;

        return (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" onClick={() => setDetailGroup(null)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl sm:mx-4" onClick={(e) => e.stopPropagation()}>
              {/* Image */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-cream-100 to-cream-200 overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
                {detailGroup.imageUrl ? (
                  <img src={detailGroup.imageUrl} alt={detailGroup.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-7xl opacity-60">{detailGroup.isCombo ? "🎁" : "🍩"}</span>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  {detailGroup.isRecommended && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow">🔥 HOT</span>
                  )}
                  {detailGroup.isCombo && (
                    <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold shadow">PAKET</span>
                  )}
                </div>
                <button onClick={() => setDetailGroup(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow text-gray-600 hover:bg-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Detail */}
              <div className="p-5 space-y-4 pb-8">
                <div>
                  <h2 className="font-bold text-lg text-gray-900 leading-snug">{detailGroup.displayName}</h2>
                  {detailGroup.description && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{detailGroup.description}</p>
                  )}
                </div>

                {/* Combo contents */}
                {detailGroup.isCombo && (
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Isi per set ({detailGroup.piecesPerUnit} pcs):</p>
                    <p className="text-xs text-purple-600">
                      {detailGroup.displayName.split(" & ").map((name, i) => (
                        <span key={i}>{i > 0 && " + "}1 {name}</span>
                      ))}
                    </p>
                  </div>
                )}

                {/* Price tiers reference — only show if more than 1 tier */}
                {detailGroup.tiers.length > 1 && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Harga:</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {detailGroup.tiers.map((t) => (
                        <div key={t.qty} className={clsx("rounded-lg py-1.5 px-2 min-w-[60px] text-center", popupQty === t.qty ? "bg-primary-100 ring-1 ring-primary-400" : "bg-white")}>
                          <p className="text-[10px] text-gray-400">{t.qty} {unit}</p>
                          <p className="text-xs font-bold text-gray-900">{formatIDR(t.price)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity input */}
                <div>
                  <div className="flex items-center justify-center gap-4 bg-cream-50 border border-gray-100 rounded-2xl p-3">
                    <button
                      onClick={() => setPopupQty(Math.max(0, popupQty - 1))}
                      className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all text-lg font-bold"
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={popupQty}
                      onChange={(e) => setPopupQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 text-center font-bold text-2xl text-gray-900 bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setPopupQty(popupQty + 1)}
                      className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center hover:bg-primary-200 text-primary-600 active:scale-95 transition-all text-lg font-bold"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Price calculation */}
                {popupQty > 0 && (
                  <div className="bg-primary-50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary-600">{popupQty} {unit} {breakdown && breakdown !== `${popupQty} ${unit}` ? `(${breakdown})` : ""}</p>
                      <p className="text-primary-700 font-bold text-xl">{formatIDR(price)}</p>
                    </div>
                    <p className="text-xs text-primary-500">
                      {formatIDR(Math.round(price / (detailGroup.isCombo ? totalPcs : popupQty)))}/{detailGroup.isCombo ? "pcs" : "pcs"}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {popupQty > 0 ? (
                    <button
                      onClick={confirmAddGroup}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
                    >
                      {currentQty > 0 ? "Update Keranjang" : "Tambah ke Keranjang"} · {formatIDR(price)}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-100 text-gray-400 rounded-2xl py-3.5 font-bold text-sm cursor-not-allowed"
                    >
                      Pilih jumlah
                    </button>
                  )}
                  {currentQty > 0 && (
                    <button
                      onClick={removeGroup}
                      className="w-full text-red-500 hover:bg-red-50 rounded-2xl py-2 text-sm font-medium transition-colors"
                    >
                      Hapus dari Keranjang
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
