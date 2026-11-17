// Klien printer untuk Web POS.
//
// Urutan strategi:
// 1. Print Agent (ESC/POS raw) — default http://127.0.0.1:17123.
//    Di PC kasir: agent di mesin yang sama. Dari HP: agent jalan di PC kasir
//    (bind LAN), URL dioverride via localStorage "printer_agent_url".
// 2. Web Bluetooth (Chrome Android + printer BLE) — kirim byte langsung ke printer.
// 3. Fallback: dialog cetak browser (window.print) dengan CSS 80mm.
//
// Override URL agent: localStorage.setItem("printer_agent_url", "...")

import { buildReceiptBytes, type ReceiptData } from "./escpos";

const DEFAULT_AGENT_URL = "http://127.0.0.1:17123";

function agentUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("printer_agent_url") || DEFAULT_AGENT_URL;
  }
  return DEFAULT_AGENT_URL;
}

export type PrintResult = { via: "agent" | "bluetooth" | "browser" };

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  const bytes = buildReceiptBytes(data);
  if (await tryAgent(bytes)) return { via: "agent" };
  if (await tryBluetooth(bytes)) return { via: "bluetooth" };
  browserPrint(data);
  return { via: "browser" };
}

export async function checkAgent(): Promise<boolean> {
  try {
    const res = await fetch(`${agentUrl()}/status`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function tryAgent(bytes: Uint8Array): Promise<boolean> {
  try {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const res = await fetch(`${agentUrl()}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: btoa(binary) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Web Bluetooth (Chrome Android / desktop Chrome, printer BLE) ---

// Service BLE yang umum dipakai printer thermal: ff00 (umum di clone),
// 18f0 (vendor serial), 49535343 (Microchip UART), 6e400001 (Nordic UART).
const BT_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

// Pilihan terakhir yang berhasil, dipakai ulang tanpa minta izin lagi
const BT_DEVICE_KEY = "printer_bt_device";

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

async function tryBluetooth(bytes: Uint8Array): Promise<boolean> {
  if (!bluetoothSupported()) return false;
  try {
    const nav = navigator as Navigator & { bluetooth: Bluetooth };
    let device: BluetoothDevice | null = null;
    const savedId = localStorage.getItem(BT_DEVICE_KEY);

    if (savedId && (nav.bluetooth as any).getDevices) {
      const devices = await (nav.bluetooth as any).getDevices();
      device = devices.find((d: any) => d.id === savedId) ?? null;
    }
    if (!device) {
      // Coba filter by service UUID dulu, kalau gagal pakai acceptAllDevices
      try {
        device = await nav.bluetooth.requestDevice({
          filters: [
            { services: [BT_SERVICES[0]] },
            { services: [BT_SERVICES[1]] },
            { services: [BT_SERVICES[2]] },
            { services: [BT_SERVICES[3]] },
            { namePrefix: "RPP" },
            { namePrefix: "POS" },
            { namePrefix: "Printer" },
            { namePrefix: "BlueTooth Printer" },
          ],
          optionalServices: BT_SERVICES,
        });
      } catch {
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: BT_SERVICES,
        });
      }
      localStorage.setItem(BT_DEVICE_KEY, (device as any).id ?? device.name ?? "");
    }

    const server = await device.gatt!.connect();
    for (const svcUuid of BT_SERVICES) {
      let service: BluetoothRemoteGATTService | undefined;
      try { service = await server.getPrimaryService(svcUuid); } catch { continue; }
      if (!service) continue;
      const chars = await service.getCharacteristics();
      const writable = chars.filter(c => c.properties.write || c.properties.writeWithoutResponse);
      for (const ch of writable) {
        for (let i = 0; i < bytes.length; i += 180) {
          await ch.writeValue(bytes.slice(i, i + 180));
        }
        return true;
      }
    }
    (server as any).disconnect?.();
    return false;
  } catch {
    return false;
  }
}

type Bluetooth = {
  requestDevice(opts: unknown): Promise<BluetoothDevice>;
  getDevices?: () => Promise<any[]>;
};
type BluetoothDevice = {
  id?: string;
  name?: string;
  gatt?: { connect(): Promise<BluetoothServer>; disconnect(): void } | null;
};
type BluetoothServer = {
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
};
type BluetoothRemoteGATTService = {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
};
type BluetoothRemoteGATTCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(value: Uint8Array): Promise<void>;
};

// --- Fallback: cetak via browser (80mm) ---

function rupiah(n: number) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

function receiptHTML(d: ReceiptData): string {
  const rows = d.items
    .map(
      (it) => `<tr><td colspan="2">${it.quantity}x ${escapeHtml(it.name)}</td></tr>
      <tr><td>&nbsp;&nbsp;${rupiah(it.price)} × ${it.quantity}</td><td style="text-align:right">${rupiah(it.price * it.quantity)}</td></tr>`
    )
    .join("");
  const method = d.paymentMethod === "CASH" ? "Tunai" : "Transfer";
  return `
  <div class="receipt">
    <h2>doughroom.co</h2>
    <p class="muted">Bakehouse Donuts${d.storeAddress ? `<br/>${escapeHtml(d.storeAddress)}` : ""}</p>
    <hr/>
    <p>No: ${escapeHtml(d.orderNumber)}<br/>
       Tgl: ${new Date(d.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false })}${d.cashierName ? `<br/>Kasir: ${escapeHtml(d.cashierName)}` : ""}<br/>Pelanggan: ${escapeHtml(d.customerName || "Walk-in")}</p>
    <hr/>
    <table>${rows}</table>
    <hr/>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${rupiah(d.subtotal)}</td></tr>
      ${d.discount && d.discount > 0 ? `<tr><td>Diskon${d.promoCode ? ` (${escapeHtml(d.promoCode)})` : ""}</td><td style="text-align:right">-${rupiah(d.discount)}</td></tr>` : ""}
      <tr class="bold"><td>TOTAL</td><td style="text-align:right">${rupiah(d.total)}</td></tr>
      <tr><td>${method}</td><td style="text-align:right">${rupiah(d.total)}</td></tr>
      ${d.paymentMethod === "CASH" && d.cashReceived != null ? `
      <tr><td>Tunai Diterima</td><td style="text-align:right">${rupiah(d.cashReceived)}</td></tr>
      <tr><td>Kembalian</td><td style="text-align:right">${rupiah(d.change ?? 0)}</td></tr>` : ""}
    </table>
    <hr/>
    <p class="center">Terima kasih atas kunjungan Anda!</p>
    ${d.footer ? `<p class="center muted">${escapeHtml(d.footer)}</p>` : ""}
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const PRINT_CSS = `
  @page { size: 80mm auto; margin: 0; }
  @media print {
    body { width: 80mm; margin: 0; padding: 3mm 4mm; }
    .no-print { display: none !important; }
  }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #000; }
  h2 { text-align: center; font-size: 18px; margin: 2mm 0 0; }
  .muted { text-align: center; font-size: 11px; margin: 0 0 2mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { vertical-align: top; padding: 0; }
`;

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua);
}

function browserPrint(data: ReceiptData) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${PRINT_CSS}
    .no-print { padding: 12px; text-align: center; background: #f0f0f0; }
    .no-print button { background: #333; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; margin: 4px; cursor: pointer; }
  </style></head><body>
  <div class="no-print">
    <button onclick="window.print()">🖨 Cetak</button>
    <button onclick="window.close()">✕ Tutup</button>
  </div>
  ${receiptHTML(data)}</body></html>`;

  if (isSafari()) {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow!.focus();
  iframe.contentWindow!.print();
  setTimeout(() => document.body.removeChild(iframe), 60_000);
}
