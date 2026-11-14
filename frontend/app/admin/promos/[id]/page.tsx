"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, formatIDR } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";

interface PromoCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface PromoUsage {
  id: string;
  order_id: string;
  discount_amount: number;
  used_at: string;
  order_number: string | null;
  customer_name: string | null;
  order_subtotal: number;
  order_total: number;
}

interface PromoUsageSummary {
  total_usages: number;
  total_normal_amount: number;
  total_discount: number;
  total_paid: number;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
}

export default function PromoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: promo, isLoading } = useQuery({
    queryKey: ["promo", id],
    queryFn: async () => {
      const { data } = await api.get(`/promos/${id}`);
      return data.data as PromoCode;
    },
    enabled: !!id,
  });

  const { data: usageData } = useQuery({
    queryKey: ["promo-usages", id],
    queryFn: async () => {
      const { data } = await api.get(`/promos/${id}/usages`, { params: { per_page: 100 } });
      return data;
    },
    enabled: !!id,
  });

  const usages: PromoUsage[] = usageData?.data?.usages ?? [];
  const summary: PromoUsageSummary | undefined = usageData?.data?.summary;
  const meta = usageData?.meta;

  if (isLoading) return <div className="p-6 text-gray-400">Memuat...</div>;
  if (!promo) return <div className="p-6 text-gray-400">Promo tidak ditemukan</div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/admin/promos")} className="text-gray-400 hover:text-gray-600" title="Kembali">
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{promo.code}</h1>
            <span className={clsx("badge-status text-xs", promo.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
              {promo.is_active ? "Aktif" : "Nonaktif"}
            </span>
          </div>
          <p className="text-sm text-gray-500">{promo.name}</p>
        </div>
      </div>

      {/* Info Promo */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Info Promo</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
          <span>Diskon</span>
          <span className="font-medium text-gray-900">
            {promo.discount_type === "PERCENTAGE"
              ? `${promo.discount_value}%${promo.max_discount ? ` (maks ${formatIDR(promo.max_discount)})` : ""}`
              : formatIDR(promo.discount_value)}
          </span>
          <span>Min. Order</span>
          <span className="font-medium text-gray-900">{promo.min_order > 0 ? formatIDR(promo.min_order) : "-"}</span>
          <span>Batas Penggunaan</span>
          <span className="font-medium text-gray-900">{promo.usage_limit ?? "Tidak terbatas"}</span>
          <span>Berlaku</span>
          <span className="font-medium text-gray-900">{formatDate(promo.valid_from)} — {formatDate(promo.valid_until)}</span>
          {promo.description && (
            <>
              <span>Deskripsi</span>
              <span className="font-medium text-gray-900">{promo.description}</span>
            </>
          )}
        </div>
      </div>

      {/* Ringkasan pemakaian */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center !p-3">
          <p className="text-[11px] text-gray-500">Pemakaian</p>
          <p className="text-lg font-bold text-gray-900">
            {promo.usage_count}{promo.usage_limit ? <span className="text-gray-400 text-sm">/{promo.usage_limit}</span> : ""}
          </p>
        </div>
        <div className="card text-center !p-3">
          <p className="text-[11px] text-gray-500">Harga Normal</p>
          <p className="text-lg font-bold text-gray-900">{formatIDR(summary?.total_normal_amount ?? 0)}</p>
        </div>
        <div className="card text-center !p-3">
          <p className="text-[11px] text-gray-500">Diskon Terpakai</p>
          <p className="text-lg font-bold text-red-600">−{formatIDR(summary?.total_discount ?? 0)}</p>
        </div>
        <div className="card text-center !p-3">
          <p className="text-[11px] text-gray-500">Dibayar Pelanggan</p>
          <p className="text-lg font-bold text-green-700">{formatIDR(summary?.total_paid ?? 0)}</p>
        </div>
      </div>

      {/* Riwayat penggunaan */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">Riwayat Penggunaan</h2>
        </div>
        {usages.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Belum ada penggunaan</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pelanggan</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Harga Normal</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Diskon</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Dibayar</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usages.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{u.order_number ?? "-"}</td>
                    <td className="px-4 py-3">{u.customer_name ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatIDR(u.order_subtotal)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">−{formatIDR(u.discount_amount)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatIDR(u.order_total)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.used_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && meta.total > usages.length && (
              <p className="text-xs text-gray-400 text-center py-2">
                Menampilkan {usages.length} penggunaan terbaru dari {meta.total}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
