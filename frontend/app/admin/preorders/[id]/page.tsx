"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { ArrowLeft, ChevronDown, ChevronUp, Package, Users } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

type Period = {
  id: string; name: string; status: string; description?: string;
  start_at: string; close_at: string; production_date: string;
  pickup_start_at: string; pickup_end_at: string;
};

type POOrder = {
  id: string; order_number: string; customer_name: string; customer_phone: string;
  total_amount: number; order_status: string; payment_status: string;
  created_at: string;
};

type QuotaItem = {
  product_id: string; product_name: string; sku: string;
  quota: number; reserved_quantity: number; confirmed_quantity: number;
};

type ProductionSummaryItem = {
  product_id: string; product_name: string;
  total_quantity: number; confirmed_quantity: number;
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

const orderStatusColors: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  READY: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function PreorderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"orders" | "quotas" | "production">("orders");
  const [orderPage, setOrderPage] = useState(1);
  const [editingQuotas, setEditingQuotas] = useState(false);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, number>>({});

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ["preorder", id],
    queryFn: async () => { const { data } = await api.get(`/preorders/${id}`); return data.data as Period; },
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["preorder-orders", id, orderPage],
    queryFn: async () => {
      const { data } = await api.get(`/preorders/${id}/orders`, { params: { page: orderPage, per_page: 20 } });
      return data;
    },
    enabled: activeTab === "orders",
  });

  const { data: quotasData, isLoading: quotasLoading } = useQuery({
    queryKey: ["preorder-quotas", id],
    queryFn: async () => {
      const { data } = await api.get(`/preorders/${id}`);
      return (data.data?.quotas ?? []) as QuotaItem[];
    },
    enabled: activeTab === "quotas",
  });

  const { data: productionData, isLoading: productionLoading } = useQuery({
    queryKey: ["preorder-production", id],
    queryFn: async () => {
      const { data } = await api.get(`/preorders/${id}/production-summary`);
      return data.data as ProductionSummaryItem[];
    },
    enabled: activeTab === "production",
  });

  const statusMutation = useMutation({
    mutationFn: async (action: string) => { await api.post(`/preorders/${id}/${action}`); },
    onSuccess: () => { toast.success("Status diperbarui"); qc.invalidateQueries({ queryKey: ["preorder", id] }); qc.invalidateQueries({ queryKey: ["preorder-periods"] }); },
    onError: () => toast.error("Gagal update status"),
  });

  const quotaMutation = useMutation({
    mutationFn: async () => {
      const quotas = Object.entries(quotaDrafts).map(([product_id, quota]) => ({ product_id, quota }));
      await api.put(`/preorders/${id}/quotas`, { quotas });
    },
    onSuccess: () => {
      toast.success("Kuota diperbarui");
      setEditingQuotas(false);
      setQuotaDrafts({});
      qc.invalidateQueries({ queryKey: ["preorder-quotas", id] });
    },
    onError: () => toast.error("Gagal update kuota"),
  });

  if (periodLoading) return <div className="p-6 text-gray-400">Memuat...</div>;
  if (!periodData) return <div className="p-6 text-red-500">Periode tidak ditemukan</div>;

  const period = periodData;
  const orders: POOrder[] = ordersData?.data ?? [];
  const orderMeta = ordersData?.meta;
  const quotas: QuotaItem[] = quotasData ?? [];
  const production: ProductionSummaryItem[] = productionData ?? [];

  const nextAction = period.status === "DRAFT" ? { label: "Buka PO", action: "open" }
    : period.status === "OPEN" ? { label: "Tutup PO", action: "close" }
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push("/admin/preorders")} className="p-2 rounded-lg hover:bg-gray-100 mt-0.5">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{period.name}</h1>
            <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[period.status])}>
              {period.status}
            </span>
          </div>
          <div className="text-sm text-gray-500 space-y-0.5">
            <p>Buka: {new Date(period.start_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} — Tutup: {new Date(period.close_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
            <p>Produksi: {new Date(period.production_date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} &nbsp;|&nbsp;
               Ambil: {new Date(period.pickup_start_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} — {new Date(period.pickup_end_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
            </p>
          </div>
        </div>
        {nextAction && (
          <button
            onClick={() => statusMutation.mutate(nextAction.action)}
            disabled={statusMutation.isPending}
            className="btn-primary text-sm"
          >
            {statusMutation.isPending ? "Memproses..." : nextAction.label}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {(["orders", "quotas", "production"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "orders" ? "Pesanan" : tab === "quotas" ? "Kuota Produk" : "Ringkasan Produksi"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {ordersLoading && <p className="text-center py-8 text-gray-400">Memuat...</p>}
          {!ordersLoading && orders.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada pesanan</p>
            </div>
          )}
          <div className="card overflow-x-auto p-0">
            {orders.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">No. Pesanan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Pelanggan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Telepon</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Bayar</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-primary-700">{o.order_number}</td>
                      <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                      <td className="px-4 py-3 text-gray-500">{o.customer_phone}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatIDR(o.total_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", orderStatusColors[o.order_status] ?? "bg-gray-100 text-gray-600")}>
                          {o.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium",
                          o.payment_status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(o.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {orderMeta && orderMeta.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Total: {orderMeta.total} pesanan</span>
              <div className="flex gap-2">
                <button onClick={() => setOrderPage(p => Math.max(1, p - 1))} disabled={orderPage === 1} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">←</button>
                <span className="px-3 py-1">{orderPage} / {orderMeta.total_pages}</span>
                <button onClick={() => setOrderPage(p => p + 1)} disabled={orderPage >= orderMeta.total_pages} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quotas tab */}
      {activeTab === "quotas" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {!editingQuotas ? (
              <button onClick={() => { setEditingQuotas(true); setQuotaDrafts({}); }} className="btn-primary text-sm">Edit Kuota</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditingQuotas(false); setQuotaDrafts({}); }} className="btn-secondary text-sm">Batal</button>
                <button onClick={() => quotaMutation.mutate()} disabled={quotaMutation.isPending} className="btn-primary text-sm">
                  {quotaMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            )}
          </div>

          {quotasLoading && <p className="text-center py-8 text-gray-400">Memuat...</p>}
          {!quotasLoading && quotas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada kuota produk</p>
            </div>
          )}

          {quotas.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Kuota</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Dipesan</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Dikonfirmasi</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Sisa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotas.map((q) => {
                    const currentQuota = quotaDrafts[q.product_id] ?? q.quota;
                    const sisa = currentQuota - q.reserved_quantity;
                    return (
                      <tr key={q.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{q.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{q.sku}</td>
                        <td className="px-4 py-3 text-center">
                          {editingQuotas ? (
                            <input
                              type="number" min="0"
                              value={quotaDrafts[q.product_id] ?? q.quota}
                              onChange={e => setQuotaDrafts(d => ({ ...d, [q.product_id]: parseInt(e.target.value) || 0 }))}
                              className="w-20 input text-center py-1 text-sm"
                            />
                          ) : (
                            <span className="font-medium">{q.quota}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-yellow-700">{q.reserved_quantity}</td>
                        <td className="px-4 py-3 text-center text-green-700">{q.confirmed_quantity}</td>
                        <td className={clsx("px-4 py-3 text-center font-medium", sisa <= 0 ? "text-red-600" : "text-gray-700")}>
                          {sisa}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Production summary tab */}
      {activeTab === "production" && (
        <div className="space-y-3">
          {productionLoading && <p className="text-center py-8 text-gray-400">Memuat...</p>}
          {!productionLoading && production.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada data produksi</p>
            </div>
          )}

          {production.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Total Dipesan</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Dikonfirmasi</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {production.map((p) => {
                    const pct = p.total_quantity > 0 ? Math.round((p.confirmed_quantity / p.total_quantity) * 100) : 0;
                    return (
                      <tr key={p.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{p.product_name}</td>
                        <td className="px-4 py-3 text-center font-semibold text-lg">{p.total_quantity}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-medium">{p.confirmed_quantity}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-primary-500 rounded-full h-2 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
