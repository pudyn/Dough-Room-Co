"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  init: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  init: () => {
    if (typeof window === "undefined") return;
    const data = localStorage.getItem("user");
    if (data) {
      try {
        set({ user: JSON.parse(data) });
      } catch {
        set({ user: null });
      }
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const { access_token, refresh_token, user } = data.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) api.post("/auth/logout", { refresh_token: refresh }).catch(() => {});
    localStorage.clear();
    set({ user: null });
    window.location.href = "/login";
  },
}));
