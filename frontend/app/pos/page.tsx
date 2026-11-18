"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { printReceipt } from "@/lib/printer";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { groupProducts, decompose, calculatePrice, getGroupQtyFromCart, formatBreakdown, type ProductGroup } from "@/lib/productTiers";
import { Search, Plus, Minus, Trash2, ShoppingCart, LogIn, LogOut as LogOutIcon, X } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types";
import clsx from "clsx";

type CartItem = { product: Product; quantity: number };
type Register = { id: string; opened_at: string; opening_balance: number; name: string };

export default function POSPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, init } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [registerModal, setRegisterModal] = useState<"open" | "close" | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [posPromoCode, setPosPromoCode] = useState("");
  const [posPromoResult, setPosPromoResult] = useState<{ promo_id: string; code: string; discount: number } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [detailGroup, setDetailGroup] = useState<ProductGroup | null>(null);
  const [popupQty, setPopupQty] = useState(0);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && !user.roles.some(r => ["OWNER","ADMIN","CASHIER"].includes(r))) {
      router.replace("/login");
    }
  }, [user, router]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => { const { data } = await api.get("/categories"); return data.data ?? data; },
  });

  const { data: products } = useQuery({
    queryKey: ["pos-products", categoryId],
    queryFn: async () => {
      const { data } = await api.get("/products", {
        params: { category_id: categoryId || undefined, per_page: 100, is_active: true },
      });
      return data.data as Product[];
    },
  });

  const { data: storeSettings } = useQuery<Record<string, string>>({
    queryKey: ["store-settings"],
    queryFn: async () => {
      try { const { data } = await api.get("/public/store"); return data.data?.settings ?? data.data ?? {}; }
      catch { return {}; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: register, refetch: refetchRegister } = useQuery<Register | null>({
    queryKey: ["pos-register"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/pos/registers/current");
        return data.data;
      } catch { return null; }
    },
  });

  const productGroups = useMemo(() => {
    const active = (products ?? []).filter(p => p.is_active);
    const groups = groupProducts(active).filter(g => g.isActive);
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => g.displayName.toLowerCase().includes(q));
  }, [products, search]);

  const openRegisterMutation = useMutation({
    mutationFn: async () => {
      await api.post("/pos/registers/open", { name: "Kasir Utama", opening_balance: parseInt(openingCash || "0", 10) });
    },
    onSuccess: () => { toast.success("Kasir dibuka"); setRegisterModal(null); refetchRegister(); },
    onError: () => toast.error("Gagal membuka kasir"),
  });

  const closeRegisterMutation = useMutation({
    mutationFn: async () => {
      await api.post("/pos/registers/close", { closing_balance: parseInt(closingCash || "0", 10) });
    },
    onSuccess: () => { toast.success("Kasir ditutup"); setRegisterModal(null); refetchRegister(); },
    onError: () => toast.error("Gagal menutup kasir"),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/pos/orders", {
        items: cart.map(ci => ({ product_id: ci.product.id, quantity: ci.quantity })),
        payment_method: paymentMethod,
        customer_name: customerName.trim() || undefined,
        promo_code_id: posPromoResult?.promo_id || undefined,
        cash_received: paymentMethod === "CASH" ? parseInt(cashReceived || "0", 10) : undefined,
      });
      return data.data;
    },
    onSuccess: (order) => {
      toast.success(`Pesanan #${order?.order_number} berhasil`);
      printReceipt({
        storeName: storeSettings?.store_name || "doughroom.co",
        storeAddress: storeSettings?.store_address || "",
        orderNumber: order?.order_number ?? "-",
        createdAt: order?.created_at ?? new Date().toISOString(),
        cashierName: user?.name,
        customerName: customerName.trim() || order?.customer_name || "Walk-in",
        items: cart.map(ci => ({ name: ci.product.name, quantity: ci.quantity, price: ci.product.selling_price })),
        subtotal: posSubtotal,
        discount: posDiscount || undefined,
        promoCode: posPromoResult?.code,
        total: order?.total_amount ?? total,
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? parseInt(cashReceived || "0", 10) || undefined : undefined,
        change: paymentMethod === "CASH" ? change : undefined,
        footer: `--- ${storeSettings?.store_name || "doughroom.co"} ---`,
      }).then(r => {
        if (r.via === "agent") toast.success("Struk tercetak");
        else if (r.via === "bluetooth") toast.success("Struk tercetak via Bluetooth");
        else toast.info("Struk dibuka di dialog cetak browser");
      }).catch(() => toast.error("Gagal mencetak struk"));
      setCart([]);
      setCashReceived("");
      setCustomerName("");
      setPosPromoCode("");
      setPosPromoResult(null);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: () => toast.error("Checkout gagal"),
  });

  function openGroupPopup(group: ProductGroup) {
    const currentQty = getGroupQtyFromCart(cart, group);
    setPopupQty(currentQty || 1);
    setDetailGroup(group);
  }

  function confirmGroupToCart() {
    if (!detailGroup || popupQty <= 0) return;
    const decomposed = decompose(detailGroup, popupQty);
    const groupProductIds = new Set(detailGroup.tiers.map(t => t.product.id));
    setCart(prev => {
      const filtered = prev.filter(ci => !groupProductIds.has(ci.product.id));
      const newItems = decomposed.map(d => ({ product: d.product, quantity: d.qty }));
      return [...filtered, ...newItems];
    });
    setDetailGroup(null);
  }

  function removeGroupFromCart() {
    if (!detailGroup) return;
    const groupProductIds = new Set(detailGroup.tiers.map(t => t.product.id));
    setCart(prev => prev.filter(ci => !groupProductIds.has(ci.product.id)));
    setDetailGroup(null);
  }

  const posSubtotal = cart.reduce((sum, ci) => sum + ci.product.selling_price * ci.quantity, 0);
  const posDiscount = posPromoResult?.discount ?? 0;
  const total = posSubtotal - posDiscount;
  const change = paymentMethod === "CASH" ? parseInt(cashReceived || "0") - total : 0;

  async function validatePosPromo() {
    if (!posPromoCode.trim()) return;
    try {
      const { data } = await api.post("/public/promos/validate", { code: posPromoCode.trim(), order_amount: posSubtotal });
      setPosPromoResult(data.data);
      toast.success(`Promo "${data.data.code}" berlaku!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Kode promo tidak valid");
      setPosPromoResult(null);
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left: Product catalog */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt="logo" className="w-8 h-8 rounded-full object-cover" />
              <span className="text-sm font-bold text-primary-800 leading-tight">doughroom.co<br/><span className="text-xs font-normal text-primary-600">POS</span></span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input text-sm pl-9 py-1.5" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {register ? (
              <button onClick={() => setRegisterModal("close")} className="btn-secondary text-xs flex items-center gap-1">
                <LogOutIcon size={13} /> Tutup Kasir
              </button>
            ) : (
              <button onClick={() => setRegisterModal("open")} className="btn-primary text-xs flex items-center gap-1">
                <LogIn size={13} /> Buka Kasir
              </button>
            )}
            <a href="/admin" className="btn-secondary text-xs">Dashboard</a>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setCategoryId("")} className={clsx("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap", !categoryId ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Semua</button>
          {(categories ?? []).map((c: { id: string; name: string }) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)} className={clsx("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap", categoryId === c.id ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{c.name}</button>
          ))}
        </div>

        {/* Products grid - grouped */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {productGroups.map(group => {
              const inCartQty = getGroupQtyFromCart(cart, group);
              const outOfStock = group.stockTracking && group.stockQuantity <= 0;
              return (
                <button key={group.key} onClick={() => !outOfStock && openGroupPopup(group)} disabled={outOfStock}
                  className={clsx("bg-white rounded-xl p-3 text-left border-2 transition-all relative", inCartQty > 0 ? "border-primary-400 shadow-sm" : "border-transparent hover:border-gray-200 hover:shadow-sm", outOfStock && "opacity-50 cursor-not-allowed")}>
                  <div className="aspect-square rounded-lg bg-amber-50 flex items-center justify-center mb-2 overflow-hidden">
                    {group.imageUrl ? <img src={group.imageUrl} alt={group.displayName} className="w-full h-full object-cover" /> : <span className="text-3xl">{group.isCombo ? "🎁" : "🍩"}</span>}
                  </div>
                  <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">{group.displayName}</p>
                  <p className="text-primary-600 font-bold text-sm mt-1">{formatIDR(group.basePrice)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">@{group.isCombo ? "set" : "pcs"}</span></p>
                  {inCartQty > 0 && (
                    <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {inCartQty}
                    </div>
                  )}
                  {outOfStock && <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded px-1">Habis</span>}
                  {group.isCombo && <span className="absolute top-2 left-2 bg-purple-500 text-white text-[9px] rounded px-1 font-semibold">PAKET</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile cart toggle */}
      {cart.length > 0 && !mobileCartOpen && (
        <button onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-40 bg-primary-600 text-white rounded-full px-5 py-3 shadow-lg flex items-center gap-2 font-semibold text-sm">
          <ShoppingCart size={18} /> {cart.reduce((s, ci) => s + ci.quantity, 0)} item · {formatIDR(total)}
        </button>
      )}

      {/* Mobile cart backdrop */}
      {mobileCartOpen && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileCartOpen(false)} />}

      {/* Right: Cart */}
      <div className={clsx(
        "bg-white border-l flex flex-col",
        "fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto",
        mobileCartOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><ShoppingCart size={18} /> Keranjang</h2>
          <div className="flex items-center gap-2">
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Kosongkan</button>}
            <button onClick={() => setMobileCartOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Belum ada item</p>}
          {cart.map(ci => (
            <div key={ci.product.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{ci.product.name}</p>
                <p className="text-xs text-gray-500">{formatIDR(ci.product.selling_price)} × {ci.quantity}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-8 text-center text-sm font-medium">{formatIDR(ci.product.selling_price * ci.quantity)}</span>
                <button onClick={() => setCart(c => c.filter(x => x.product.id !== ci.product.id))} className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-50 ml-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout */}
        <div className="p-4 border-t space-y-3">
          {posDiscount > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatIDR(posSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Diskon ({posPromoResult?.code})</span>
                <span>-{formatIDR(posDiscount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary-600">{formatIDR(total)}</span>
          </div>

          <input
            className="input text-sm"
            placeholder="Nama pelanggan (opsional)"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />

          {/* Promo code */}
          <div className="flex gap-1">
            <input
              className="input text-xs flex-1"
              placeholder="Kode promo"
              value={posPromoCode}
              onChange={(e) => setPosPromoCode(e.target.value.toUpperCase())}
            />
            <button onClick={validatePosPromo} className="bg-primary-100 text-primary-700 px-2 rounded-lg text-xs font-medium hover:bg-primary-200">Pakai</button>
            {posPromoResult && <button onClick={() => { setPosPromoResult(null); setPosPromoCode(""); }} className="text-red-400 hover:text-red-600 text-xs px-1">×</button>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["CASH","BANK_TRANSFER"] as const).map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={clsx("py-2 rounded-lg text-sm font-medium border transition-colors", paymentMethod === m ? "bg-primary-500 text-white border-primary-500" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                {m === "CASH" ? "Tunai" : "Transfer"}
              </button>
            ))}
          </div>

          {paymentMethod === "CASH" && (
            <div>
              <label className="label text-xs">Uang Diterima</label>
              <input className="input text-sm" type="number" placeholder="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
              {cashReceived && parseInt(cashReceived) >= total && (
                <p className="text-xs text-green-600 mt-1 font-medium">Kembalian: {formatIDR(change)}</p>
              )}
              {cashReceived && parseInt(cashReceived) < total && (
                <p className="text-xs text-red-500 mt-1">Kurang: {formatIDR(total - parseInt(cashReceived))}</p>
              )}
            </div>
          )}

          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={cart.length === 0 || checkoutMutation.isPending || !register || (paymentMethod === "CASH" && parseInt(cashReceived || "0") < total)}
            className="btn-primary w-full disabled:opacity-50"
          >
            {checkoutMutation.isPending ? "Memproses..." : "Bayar"}
          </button>
          {!register && <p className="text-xs text-center text-red-500">Buka kasir terlebih dahulu</p>}
        </div>
      </div>

      {/* Product quantity popup */}
      {detailGroup && (() => {
        const price = calculatePrice(detailGroup, popupQty);
        const breakdown = formatBreakdown(detailGroup, popupQty);
        const currentQty = getGroupQtyFromCart(cart, detailGroup);
        const unit = detailGroup.isCombo ? "set" : "pcs";
        const totalPcs = detailGroup.isCombo ? popupQty * detailGroup.piecesPerUnit : popupQty;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDetailGroup(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white w-full max-w-sm mx-4 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Compact header */}
              <div className="flex items-center gap-3 p-4 border-b">
                <div className="w-14 h-14 rounded-lg bg-amber-50 flex-shrink-0 overflow-hidden">
                  {detailGroup.imageUrl ? <img src={detailGroup.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{detailGroup.isCombo ? "🎁" : "🍩"}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-tight truncate">{detailGroup.displayName}</p>
                  {detailGroup.isCombo && (
                    <p className="text-[10px] text-purple-600 mt-0.5">
                      {detailGroup.displayName.split(" & ").map((n, i) => (i > 0 ? " + " : "") + "1 " + n.replace(/ Donut$/, "")).join("")} per set
                    </p>
                  )}
                </div>
                <button onClick={() => setDetailGroup(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              {/* Price tiers */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex gap-1 overflow-x-auto">
                  {detailGroup.tiers.map(t => (
                    <button key={t.qty} onClick={() => setPopupQty(t.qty)}
                      className={clsx("flex-1 min-w-0 rounded-lg py-2 px-1 text-center border transition-colors", popupQty === t.qty ? "bg-primary-50 border-primary-400" : "border-gray-100 hover:border-gray-200")}>
                      <p className="text-[10px] text-gray-400">{t.qty} {unit}</p>
                      <p className="text-xs font-bold text-gray-900">{formatIDR(t.product.selling_price)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty input */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setPopupQty(Math.max(0, popupQty - 1))} className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95">
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={popupQty}
                    onChange={e => setPopupQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center font-bold text-xl text-gray-900 bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setPopupQty(popupQty + 1)} className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center hover:bg-primary-200 text-primary-600 active:scale-95">
                    <Plus size={16} />
                  </button>
                </div>
                {popupQty > 0 && breakdown && (
                  <p className="text-center text-[10px] text-gray-400 mt-1">{breakdown}</p>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 space-y-2">
                {popupQty > 0 ? (
                  <button onClick={confirmGroupToCart} className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98] transition-all">
                    {currentQty > 0 ? "Update" : "Tambah"} · {formatIDR(price)}
                    {detailGroup.isCombo && <span className="font-normal text-primary-200 ml-1">({totalPcs} pcs)</span>}
                  </button>
                ) : (
                  <button disabled className="w-full bg-gray-100 text-gray-400 rounded-xl py-3 font-bold text-sm cursor-not-allowed">Pilih jumlah</button>
                )}
                {currentQty > 0 && popupQty === 0 && (
                  <button onClick={removeGroupFromCart} className="w-full text-red-500 hover:bg-red-50 rounded-xl py-2 text-sm font-medium transition-colors">
                    Hapus dari Keranjang
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Register Modal */}
      {registerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="font-bold text-gray-900">{registerModal === "open" ? "Buka Kasir" : "Tutup Kasir"}</h3>
            <div>
              <label className="label">{registerModal === "open" ? "Uang Kas Awal" : "Uang Kas Akhir"}</label>
              <input className="input" type="number" placeholder="0"
                value={registerModal === "open" ? openingCash : closingCash}
                onChange={e => registerModal === "open" ? setOpeningCash(e.target.value) : setClosingCash(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRegisterModal(null)} className="btn-secondary flex-1">Batal</button>
              <button
                onClick={() => registerModal === "open" ? openRegisterMutation.mutate() : closeRegisterMutation.mutate()}
                disabled={openRegisterMutation.isPending || closeRegisterMutation.isPending}
                className="btn-primary flex-1">
                {registerModal === "open" ? "Buka" : "Tutup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
