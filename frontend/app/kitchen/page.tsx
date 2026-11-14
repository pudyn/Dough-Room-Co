"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayJakarta } from "@/lib/date";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Clock, ChefHat, Bell, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

type OrderItem = { product_name: string; quantity: number; notes?: string };
type KitchenOrder = {
  id: string; order_number: string; order_status: string;
  source: string; customer_name?: string; created_at: string;
  items: OrderItem[];
};

const statusConfig = {
  CONFIRMED: { label: "Antrian", color: "border-blue-400 bg-blue-50", badge: "bg-blue-100 text-blue-700", next: "PREPARING", nextLabel: "Mulai Buat" },
  PREPARING: { label: "Diproses", color: "border-yellow-400 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", next: "READY", nextLabel: "Siap Ambil" },
  READY: { label: "Siap Ambil", color: "border-green-400 bg-green-50", badge: "bg-green-100 text-green-700", next: "COMPLETED", nextLabel: "Selesai" },
};

function minutesAgo(dt: string) {
  const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
  if (diff < 1) return "baru saja";
  if (diff < 60) return `${diff} mnt lalu`;
  return `${Math.floor(diff / 60)} jam lalu`;
}

export default function KitchenPage() {
  const router = useRouter();
  const { user, init } = useAuth();
  const qc = useQueryClient();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && !user.roles.some(r => ["OWNER","ADMIN","KITCHEN","CASHIER"].includes(r))) {
      router.replace("/login");
    }
  }, [user, router]);

  const { data, refetch } = useQuery({
    queryKey: ["kitchen-queue"],
    queryFn: async () => {
      const today = todayJakarta();
      const { data } = await api.get("/production/queue", { params: { date: today } });
      return data.data as KitchenOrder[];
    },
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/production/orders/${id}/status`, { status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kitchen-queue"] }); },
    onError: () => toast.error("Gagal update status"),
  });

  const orders = data ?? [];
  const confirmed = orders.filter(o => o.order_status === "CONFIRMED");
  const preparing = orders.filter(o => o.order_status === "PREPARING");
  const ready = orders.filter(o => o.order_status === "READY");

  function OrderCard({ order }: { order: KitchenOrder }) {
    const cfg = statusConfig[order.order_status as keyof typeof statusConfig];
    if (!cfg) return null;
    return (
      <div className={clsx("rounded-xl border-2 p-4 space-y-3", cfg.color)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-gray-900">{order.order_number}</p>
            <p className="text-sm text-gray-600">{order.customer_name ?? "Walk-in"} · {order.source}</p>
          </div>
          <div className="text-right">
            <span className={clsx("badge-status text-xs", cfg.badge)}>{cfg.label}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 justify-end">
              <Clock size={11} />
              {minutesAgo(order.created_at)}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start justify-between text-sm">
              <span className="font-medium text-gray-800">{item.product_name}</span>
              <span className="text-gray-600 font-bold">×{item.quantity}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => updateMutation.mutate({ id: order.id, status: cfg.next })}
          disabled={updateMutation.isPending}
          className={clsx("w-full py-2 rounded-lg text-sm font-semibold transition-colors",
            cfg.next === "PREPARING" ? "bg-yellow-500 hover:bg-yellow-600 text-white" :
            cfg.next === "READY" ? "bg-green-500 hover:bg-green-600 text-white" :
            "bg-gray-700 hover:bg-gray-800 text-white"
          )}>
          {cfg.nextLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="logo" className="w-9 h-9 rounded-full object-cover" />
          <div>
            <h1 className="text-base font-bold leading-tight">Kitchen Display</h1>
            <p className="text-gray-400 text-xs">doughroom.co Bakehouse Donuts</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Bell size={14} className="text-blue-400" /> {confirmed.length} antrian</span>
          <span className="flex items-center gap-1"><ChefHat size={14} className="text-yellow-400" /> {preparing.length} diproses</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> {ready.length} siap</span>
          <button onClick={() => refetch()} className="text-gray-400 hover:text-white text-xs border border-gray-600 rounded px-2 py-1">Refresh</button>
          <a href="/admin" className="text-gray-400 hover:text-white text-xs border border-gray-600 rounded px-2 py-1">Admin</a>
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4 p-6 h-[calc(100vh-73px)] overflow-hidden">
        {/* Antrian */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <h2 className="text-blue-400 font-semibold flex items-center gap-2 sticky top-0 bg-gray-900 pb-2">
            <Bell size={16} /> Antrian ({confirmed.length})
          </h2>
          {confirmed.map(o => <OrderCard key={o.id} order={o} />)}
          {confirmed.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Tidak ada antrian</p>}
        </div>

        {/* Diproses */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <h2 className="text-yellow-400 font-semibold flex items-center gap-2 sticky top-0 bg-gray-900 pb-2">
            <ChefHat size={16} /> Diproses ({preparing.length})
          </h2>
          {preparing.map(o => <OrderCard key={o.id} order={o} />)}
          {preparing.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Tidak ada pesanan</p>}
        </div>

        {/* Siap Ambil */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <h2 className="text-green-400 font-semibold flex items-center gap-2 sticky top-0 bg-gray-900 pb-2">
            <CheckCircle size={16} /> Siap Ambil ({ready.length})
          </h2>
          {ready.map(o => <OrderCard key={o.id} order={o} />)}
          {ready.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Tidak ada</p>}
        </div>
      </div>
    </div>
  );
}
