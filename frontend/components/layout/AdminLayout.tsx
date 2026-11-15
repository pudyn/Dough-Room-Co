"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Package, ShoppingCart, Users, BarChart3,
  Settings, LogOut, ChefHat, QrCode, Calendar, Boxes, Tag, Ticket, Landmark, Star, MessageSquare, Menu, X
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ADMIN", "CASHIER"] },
  { href: "/admin/products", label: "Produk", icon: Package, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/categories", label: "Kategori", icon: Tag, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "CASHIER"] },
  { href: "/admin/preorders", label: "Pre-Order", icon: Calendar, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/inventory", label: "Inventaris", icon: Boxes, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/customers", label: "Pelanggan", icon: Users, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/promos", label: "Promo", icon: Ticket, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/reviews", label: "Review", icon: Star, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/feedback", label: "Kritik & Saran", icon: MessageSquare, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/cashier", label: "Riwayat Kasir", icon: Landmark, roles: ["OWNER", "ADMIN", "CASHIER"] },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/qr", label: "QR Code", icon: QrCode, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/users", label: "Pengguna", icon: Users, roles: ["OWNER"] },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings, roles: ["OWNER", "ADMIN"] },
  { href: "/pos", label: "POS", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "CASHIER"] },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat, roles: ["OWNER", "ADMIN", "KITCHEN"] },
];

function SidebarContent({
  user, pathname, allowedItems, onNavigate, logout,
}: {
  user: { name?: string } | null;
  pathname: string;
  allowedItems: typeof navItems;
  onNavigate?: () => void;
  logout: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-gray-200 bg-cream-100">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="doughroom.co" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div>
            <p className="font-bold text-primary-800 text-sm leading-tight">doughroom.co</p>
            <p className="text-xs text-primary-600 leading-tight">Bakehouse Donuts</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {allowedItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5",
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"))
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-200">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </div>
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, init, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!user) {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!token) router.replace("/login");
    }
  }, [user, router]);

  // Tutup drawer saat pindah halaman
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Kunci scroll body saat drawer terbuka
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const allowedItems = navItems.filter(
    (item) => !user || item.roles.some((r) => user.roles.includes(r))
  );

  const currentLabel = navItems.find(
    (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"))
  )?.label ?? "Dashboard";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <SidebarContent user={user} pathname={pathname} allowedItems={allowedItems} logout={logout} />
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Tutup menu"
            >
              <X size={18} />
            </button>
            <SidebarContent
              user={user}
              pathname={pathname}
              allowedItems={allowedItems}
              logout={logout}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.jpg" alt="doughroom.co" className="w-7 h-7 rounded-full object-cover" />
          <span className="font-bold text-primary-800 text-sm">{currentLabel}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
