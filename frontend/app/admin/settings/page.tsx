"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Save, Plus, Trash2, Upload, Printer, Download, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type BankAccount = { id: string; bank_name: string; account_number: string; account_holder: string; is_active: boolean };
type Settings = Record<string, string>;

type PrinterStatus = { ok: boolean; printer: string; printers: string[] } | null;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [printerAgentUrl, setPrinterAgentUrl] = useState("");
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(null);
  const [printerChecking, setPrinterChecking] = useState(false);

  // Load saved printer agent URL
  useEffect(() => {
    try { setPrinterAgentUrl(localStorage.getItem("printer_agent_url") || ""); } catch {}
  }, []);

  async function checkPrinter() {
    setPrinterChecking(true);
    const url = printerAgentUrl || "http://127.0.0.1:17123";
    try {
      const res = await fetch(`${url}/status`, { method: "GET", signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setPrinterStatus(data);
      toast.success(`Printer agent terhubung — ${data.printer || "no default"}`);
    } catch {
      setPrinterStatus(null);
      toast.error("Printer agent tidak terjangkau");
    } finally {
      setPrinterChecking(false);
    }
  }

  function savePrinterUrl() {
    try {
      if (printerAgentUrl) {
        localStorage.setItem("printer_agent_url", printerAgentUrl);
      } else {
        localStorage.removeItem("printer_agent_url");
      }
      toast.success("URL printer agent disimpan");
    } catch { toast.error("Gagal menyimpan"); }
  }

  async function testPrint() {
    const url = printerAgentUrl || "http://127.0.0.1:17123";
    const init = [0x1B, 0x40];
    const center = [0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11];
    const normal = [0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00];
    const feed = [0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00];
    const enc = new TextEncoder();
    const bytes = new Uint8Array([
      ...init, ...center,
      ...enc.encode("TEST PRINT\n"),
      ...normal,
      ...enc.encode("Printer OK!\n"),
      ...enc.encode(new Date().toLocaleString("id-ID") + "\n"),
      ...feed,
    ]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    try {
      const res = await fetch(`${url}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: btoa(binary) }),
      });
      if (res.ok) toast.success("Test print terkirim!");
      else toast.error("Print gagal");
    } catch {
      toast.error("Printer agent tidak terjangkau");
    }
  }

  const [settings, setSettings] = useState<Settings>({
    store_name: "",
    store_address: "",
    store_phone: "",
    store_whatsapp: "",
    order_expiry_minutes: "60",
    max_preorder_quantity: "100",
  });
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", account_holder: "" });
  const [showBankForm, setShowBankForm] = useState(false);

  const { data: storeSettings } = useQuery<Settings>({
    queryKey: ["store-settings-admin"],
    queryFn: async () => {
      try { const { data } = await api.get("/store/settings"); return data.data; }
      catch { return {}; }
    },
  });

  const { data: banks } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: async () => { const { data } = await api.get("/bank-accounts"); return data.data; },
  });

  useEffect(() => {
    if (storeSettings) setSettings(prev => ({ ...prev, ...storeSettings }));
  }, [storeSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        if (value) await api.post("/store/settings", { key, value }).catch(() => {});
      }
    },
    onSuccess: () => { toast.success("Pengaturan disimpan"); qc.invalidateQueries({ queryKey: ["store-settings-admin"] }); },
    onError: () => toast.error("Gagal menyimpan"),
  });

  const addBankMutation = useMutation({
    mutationFn: async () => { await api.post("/bank-accounts", bankForm); },
    onSuccess: () => {
      toast.success("Rekening ditambahkan");
      setBankForm({ bank_name: "", account_number: "", account_holder: "" });
      setShowBankForm(false);
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: () => toast.error("Gagal menambah rekening"),
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/bank-accounts/${id}`); },
    onSuccess: () => { toast.success("Rekening dihapus"); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
    onError: () => toast.error("Gagal menghapus"),
  });

  const toggleBankMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { await api.put(`/bank-accounts/${id}`, { is_active: active }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });

  const qrisInputRef = useRef<HTMLInputElement>(null);
  const [uploadingQris, setUploadingQris] = useState(false);

  async function uploadQris(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQris(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { data } = await api.post("/store/qris-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSettings(s => ({ ...s, qris_image_url: data.data.qris_image_url }));
      qc.invalidateQueries({ queryKey: ["store-settings-admin"] });
      toast.success("Gambar QR tersimpan");
    } catch {
      toast.error("Gagal upload gambar QR");
    } finally {
      setUploadingQris(false);
      e.target.value = "";
    }
  }

  const fields = [
    { key: "store_name", label: "Nama Toko", type: "text" },
    { key: "store_address", label: "Alamat Toko", type: "text" },
    { key: "store_phone", label: "No. Telepon", type: "tel" },
    { key: "store_whatsapp", label: "No. WhatsApp", type: "tel" },
    { key: "order_expiry_minutes", label: "Batas Waktu Pembayaran (menit)", type: "number" },
    { key: "max_preorder_quantity", label: "Maks. Kuantitas Pre-Order per Produk", type: "number" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>

      {/* Store settings */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Informasi Toko</h2>
        {fields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" type={f.type} value={settings[f.key] ?? ""} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} />
          </div>
        ))}
        <button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}
          className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saveSettingsMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>

      {/* Bank accounts */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rekening Bank</h2>
          <button onClick={() => setShowBankForm(!showBankForm)} className="btn-secondary flex items-center gap-1 text-sm"><Plus size={14} /> Tambah</button>
        </div>

        {showBankForm && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Nama Bank *</label>
                <input className="input text-sm" value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="BCA" />
              </div>
              <div>
                <label className="label text-xs">No. Rekening *</label>
                <input className="input text-sm font-mono" value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="label text-xs">Nama Pemilik *</label>
                <input className="input text-sm" value={bankForm.account_holder} onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBankForm(false)} className="btn-secondary text-sm flex-1">Batal</button>
              <button onClick={() => addBankMutation.mutate()} disabled={addBankMutation.isPending || !bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder}
                className="btn-primary text-sm flex-1">
                {addBankMutation.isPending ? "Menyimpan..." : "Tambah Rekening"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(banks ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Belum ada rekening bank</p>}
          {(banks ?? []).map(b => (
            <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border ${b.is_active ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
              <div>
                <p className="font-semibold text-sm text-gray-900">{b.bank_name}</p>
                <p className="font-mono text-sm text-gray-700">{b.account_number}</p>
                <p className="text-xs text-gray-500">{b.account_holder}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleBankMutation.mutate({ id: b.id, active: !b.is_active })}
                  className={`text-xs px-2 py-1 rounded border font-medium ${b.is_active ? "border-yellow-200 text-yellow-600 hover:bg-yellow-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                  {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button onClick={() => { if (confirm("Hapus rekening ini?")) deleteBankMutation.mutate(b.id); }}
                  className="text-red-400 hover:text-red-600 p-1"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QRIS statis (GoPay merchant) */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">QRIS (GoPay) — QR Statis</h2>
        <p className="text-xs text-gray-500">
          Gambar QR ini akan muncul di halaman pesanan pelanggan saat mereka memilih pembayaran <strong>QRIS</strong>.
          Setelah scan & bayar, pelanggan upload bukti — Anda verifikasi dari menu Pesanan seperti biasa.
        </p>
        {settings.qris_image_url ? (
          <img src={settings.qris_image_url} alt="QRIS" className="w-56 mx-auto rounded-xl border bg-white p-2" />
        ) : (
          <div className="text-center space-y-2">
            <img src="/qris-gopay.png" alt="QRIS bawaan" className="w-56 mx-auto rounded-xl border bg-white p-2" />
            <p className="text-xs text-gray-400">Sedang memakai gambar QR bawaan (qris-gopay.png). Upload di bawah untuk mengganti.</p>
          </div>
        )}
        <input ref={qrisInputRef} type="file" accept="image/*" className="hidden" onChange={uploadQris} />
        <button onClick={() => qrisInputRef.current?.click()} disabled={uploadingQris} className="btn-secondary flex items-center gap-2">
          <Upload size={16} /> {uploadingQris ? "Mengunggah..." : settings.qris_image_url ? "Ganti Gambar QR" : "Upload Gambar QR"}
        </button>
      </div>

      {/* Printer Thermal */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Printer size={20} className="text-gray-700" />
          <h2 className="font-semibold text-gray-900">Printer Thermal</h2>
        </div>
        <p className="text-xs text-gray-500">
          Printer agent adalah aplikasi kecil yang jalan di PC kasir untuk mencetak struk ESC/POS
          langsung ke printer thermal (Bluetooth/USB) tanpa dialog cetak browser.
        </p>

        {/* Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
            <Download size={16} /> Download Printer Agent
          </h3>
          <p className="text-xs text-blue-700">
            Download dan jalankan di setiap PC/laptop kasir. Cukup sekali — setelah itu struk
            otomatis tercetak setelah checkout.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/printer-agent.exe" download className="btn-primary text-sm flex items-center gap-2 no-underline">
              <Download size={14} /> printer-agent.exe (Windows)
            </a>
          </div>
          <p className="text-[11px] text-blue-600">
            Jalankan file, lalu buka{" "}
            <code className="bg-blue-100 px-1 rounded">http://127.0.0.1:17123/status</code>{" "}
            di browser untuk cek koneksi.
          </p>
        </div>

        {/* Printer URL — untuk tablet/HP di jaringan */}
        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Wifi size={16} /> Koneksi Printer Agent
          </h3>
          <p className="text-xs text-gray-500">
            Kosongkan untuk PC kasir (default <code className="bg-gray-200 px-1 rounded">localhost:17123</code>).
            Untuk <strong>tablet/HP di jaringan WiFi yang sama</strong>, isi dengan IP PC kasir yang menjalankan agent,
            contoh: <code className="bg-gray-200 px-1 rounded">http://192.168.1.10:17123</code>
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              placeholder="http://192.168.1.10:17123"
              value={printerAgentUrl}
              onChange={e => setPrinterAgentUrl(e.target.value)}
            />
            <button onClick={savePrinterUrl} className="btn-secondary text-sm whitespace-nowrap">
              <Save size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={checkPrinter} disabled={printerChecking}
              className="btn-secondary text-sm flex items-center gap-2">
              {printerChecking ? "Mengecek..." : "Cek Koneksi"}
            </button>
            <button onClick={testPrint} className="btn-secondary text-sm flex items-center gap-2">
              <Printer size={14} /> Test Print
            </button>
          </div>

          {printerStatus && (
            <div className="bg-white border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {printerStatus.ok ? (
                  <><CheckCircle2 size={16} className="text-green-500" /> <span className="text-green-700 font-medium">Terhubung</span></>
                ) : (
                  <><XCircle size={16} className="text-red-500" /> <span className="text-red-700 font-medium">Tidak terhubung</span></>
                )}
              </div>
              {printerStatus.printer && (
                <p className="text-xs text-gray-600">Printer default: <strong>{printerStatus.printer}</strong></p>
              )}
              {printerStatus.printers && printerStatus.printers.filter(p => p.length > 2).length > 0 && (
                <div className="text-xs text-gray-500">
                  <span>Daftar printer: </span>
                  {printerStatus.printers.filter(p => p.length > 2 && !p.includes("\n") && !p.includes("\x00")).map((p, i) => (
                    <span key={i} className="inline-block bg-gray-100 rounded px-2 py-0.5 mr-1 mb-1 font-mono">{p}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
