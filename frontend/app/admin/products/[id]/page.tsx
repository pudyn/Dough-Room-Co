"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Upload, Plus, Minus } from "lucide-react";

type Category = { id: string; name: string };

export default function ProductFormPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useParams();
  const id = params?.id as string | undefined;
  const isNew = !id || id === "new";
  const [stockQty, setStockQty] = useState("");
  const [stockType, setStockType] = useState<"restock" | "adjust">("restock");

  const [form, setForm] = useState({
    name: "", sku: "", description: "", category_id: "",
    selling_price: "", cost_price: "", is_active: true,
    stock_tracking: true, low_stock_threshold: "5",
    sales_modes: ["READY_STOCK"] as string[],
    initial_stock: "0",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data.data ?? data;
    },
  });

  const { data: product } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return data.data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name ?? "",
        sku: product.sku ?? "",
        description: product.description ?? "",
        category_id: product.category_id ?? "",
        selling_price: String(product.selling_price ?? ""),
        cost_price: String(product.cost_price ?? ""),
        is_active: product.is_active ?? true,
        stock_tracking: product.stock_tracking ?? true,
        low_stock_threshold: String(product.low_stock_threshold ?? 5),
        sales_modes: product.sales_modes ?? ["READY_STOCK"],
        initial_stock: "0",
      });
      if (product.image_url) setImagePreview(product.image_url);
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { initial_stock, ...rest } = form;
      const payload: Record<string, unknown> = {
        ...rest,
        selling_price: parseInt(form.selling_price, 10),
        cost_price: form.cost_price ? parseInt(form.cost_price, 10) : undefined,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10),
        stock_quantity: parseInt(initial_stock, 10),
      };
      if (isNew) {
        const { data } = await api.post("/products", payload);
        return data.data;
      } else {
        const { data } = await api.put(`/products/${id}`, payload);
        return data.data;
      }
    },
    onSuccess: async (p) => {
      if (imageFile && p?.id) {
        const fd = new FormData();
        fd.append("image", imageFile);
        await api.post(`/products/${p.id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success(isNew ? "Produk ditambahkan" : "Produk diperbarui");
      router.push("/admin/products");
    },
    onError: () => toast.error("Gagal menyimpan produk"),
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(stockQty, 10);
      if (!qty || qty <= 0) throw new Error("Jumlah tidak valid");
      const endpoint = stockType === "restock" ? "/inventory/restocks" : "/inventory/adjustments";
      const type = stockType === "restock" ? "PURCHASE" : "ADJUSTMENT";
      await api.post(endpoint, { product_id: id, type, quantity: qty, notes: "" });
    },
    onSuccess: () => {
      toast.success("Stok diperbarui");
      setStockQty("");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e: Error) => toast.error(e.message || "Gagal update stok"),
  });

  function toggleMode(mode: string) {
    setForm(f => ({
      ...f,
      sales_modes: f.sales_modes.includes(mode)
        ? f.sales_modes.filter(m => m !== mode)
        : [...f.sales_modes, mode],
    }));
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? "Tambah Produk" : "Edit Produk"}</h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-6">
        {/* Image */}
        <div className="card flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
            {imagePreview ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-3xl">🍩</span>}
          </div>
          <div>
            <label className="btn-secondary cursor-pointer flex items-center gap-2">
              <Upload size={14} /> Upload Gambar
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, max 2MB</p>
          </div>
        </div>

        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Informasi Produk</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nama Produk *</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Auto-generate jika kosong" />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Pilih kategori...</option>
                {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Harga Jual *</label>
              <input className="input" type="number" required min="0" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0" />
              {form.selling_price && <p className="text-xs text-gray-400 mt-1">{formatIDR(parseInt(form.selling_price) || 0)}</p>}
            </div>
            <div>
              <label className="label">Harga Modal</label>
              <input className="input" type="number" min="0" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="label">Deskripsi</label>
              <textarea className="input min-h-20 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Sales modes */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Mode Penjualan</h2>
          <div className="flex gap-3">
            {["READY_STOCK", "PREORDER"].map(mode => (
              <button type="button" key={mode} onClick={() => toggleMode(mode)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${form.sales_modes.includes(mode) ? "bg-primary-500 text-white border-primary-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                {mode === "READY_STOCK" ? "Ready Stock" : "Pre-Order"}
              </button>
            ))}
          </div>
        </div>

        {/* Stock */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Stok</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.stock_tracking} onChange={e => setForm(f => ({ ...f, stock_tracking: e.target.checked }))} />
              Lacak stok
            </label>
          </div>
          {form.stock_tracking && (
            <div className="grid grid-cols-2 gap-4">
              {isNew && (
                <div>
                  <label className="label">Stok Awal</label>
                  <input className="input" type="number" min="0" value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="label">Ambang Stok Menipis</label>
                <input className="input" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* Stock management — edit only */}
        {!isNew && form.stock_tracking && (
          <div className="card space-y-3">
            <h2 className="font-semibold text-gray-900">
              Update Stok
              {product && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  Stok saat ini: <strong className="text-gray-900">{product.stock_quantity}</strong>
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStockType("restock")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${stockType === "restock" ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500"}`}
              >
                <Plus size={14} /> Restock
              </button>
              <button
                type="button"
                onClick={() => setStockType("adjust")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${stockType === "adjust" ? "bg-orange-50 border-orange-300 text-orange-700" : "border-gray-200 text-gray-500"}`}
              >
                <Minus size={14} /> Penyesuaian
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                className="input flex-1"
                placeholder="Jumlah"
                value={stockQty}
                onChange={e => setStockQty(e.target.value)}
              />
              <button
                type="button"
                disabled={!stockQty || stockMutation.isPending}
                onClick={() => stockMutation.mutate()}
                className="btn-primary px-4 disabled:opacity-50"
              >
                {stockMutation.isPending ? "..." : "Simpan"}
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Status Produk</p>
            <p className="text-sm text-gray-500">{form.is_active ? "Aktif - tampil di menu" : "Tidak aktif - disembunyikan"}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-checked:bg-primary-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Batal</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? "Menyimpan..." : "Simpan Produk"}
          </button>
        </div>
      </form>
    </div>
  );
}
