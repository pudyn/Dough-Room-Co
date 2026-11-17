// ESC/POS builder untuk printer thermal 80mm (head 576 dot = 48 karakter font A).

export type ReceiptItem = { name: string; quantity: number; price: number };

export type ReceiptData = {
  storeName: string;
  storeAddress?: string;
  orderNumber: string;
  createdAt: string;
  cashierName?: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  promoCode?: string;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  footer?: string;
};

const WIDTH = 48;

class EscPosBuilder {
  private parts: number[] = [];

  push(...bytes: number[]) {
    this.parts.push(...bytes);
    return this;
  }

  text(s: string) {
    for (const ch of s) {
      const cp = ch.codePointAt(0) ?? 63;
      this.parts.push(cp <= 0xff ? cp : 63); // karakter non-latin1 → "?"
    }
    return this;
  }

  raw(bytes: number[]) {
    this.parts.push(...bytes);
    return this;
  }

  init() {
    return this.raw([0x1b, 0x40]);
  }

  align(mode: "left" | "center" | "right") {
    return this.raw([0x1b, 0x61, mode === "left" ? 0 : mode === "center" ? 1 : 2]);
  }

  bold(on: boolean) {
    return this.raw([0x1b, 0x45, on ? 1 : 0]);
  }

  doubleSize(on: boolean) {
    return this.raw([0x1d, 0x21, on ? 0x11 : 0x00]);
  }

  feed(n = 1) {
    return this.raw([0x1b, 0x64, n]);
  }

  cut() {
    return this.raw([0x1d, 0x56, 0x42, 0x00]); // partial cut
  }

  openDrawer() {
    return this.raw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  }

  qr(content: string) {
    const data = Array.from(new TextEncoder().encode(content));
    const len = data.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    this.raw([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // model 2, ukuran sedang
    this.raw([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]); // simpan data
    this.push(...data);
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]); // cetak
    return this;
  }

  line(char = "-") {
    return this.text(char.repeat(WIDTH) + "\n");
  }

  leftRight(left: string, right: string) {
    const r = right.slice(0, Math.max(0, WIDTH - 2));
    const l = left.length + r.length > WIDTH ? left.slice(0, Math.max(0, WIDTH - r.length)) : left;
    return this.text(l + " ".repeat(WIDTH - l.length - r.length) + r + "\n");
  }

  wrap(s: string) {
    for (let i = 0; i < s.length; i += WIDTH) {
      this.text(s.slice(i, i + WIDTH) + "\n");
    }
    return this;
  }

  centerText(s: string) {
    this.align("center");
    this.wrap(s);
    this.align("left");
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.parts);
  }
}

function formatIDR(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function buildReceiptBytes(d: ReceiptData): Uint8Array {
  const p = new EscPosBuilder();
  p.init();
  p.align("center").bold(true).doubleSize(true);
  p.text("doughroom.co\n");
  p.doubleSize(false).bold(false);
  p.text("Bakehouse Donuts\n");
  if (d.storeAddress) p.text(d.storeAddress + "\n");
  p.align("left");
  p.line("=");

  p.text(`No: ${d.orderNumber}\n`);
  p.text(`Tgl: ${new Date(d.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false })}\n`);
  if (d.cashierName) p.text(`Kasir: ${d.cashierName}\n`);
  p.text(`Pelanggan: ${d.customerName || "Walk-in"}\n`);
  p.line("-");

  for (const it of d.items) {
    p.wrap(`${it.quantity}x ${it.name}`);
    p.leftRight("  " + formatIDR(it.price) + " x " + it.quantity, formatIDR(it.price * it.quantity));
  }
  p.line("-");

  p.leftRight("Subtotal", formatIDR(d.subtotal));
  if (d.discount && d.discount > 0) {
    p.leftRight(`Diskon${d.promoCode ? ` (${d.promoCode})` : ""}`, "-" + formatIDR(d.discount));
  }
  p.bold(true);
  p.leftRight("TOTAL", formatIDR(d.total));
  p.bold(false);

  const method = d.paymentMethod === "CASH" ? "Tunai" : "Transfer";
  p.leftRight(method, formatIDR(d.total));
  if (d.paymentMethod === "CASH" && d.cashReceived != null) {
    p.leftRight("Tunai Diterima", formatIDR(d.cashReceived));
    p.leftRight("Kembalian", formatIDR(d.change ?? 0));
  }
  p.line("=");

  p.centerText("Terima kasih atas kunjungan Anda!");
  if (d.footer) p.centerText(d.footer);
  p.feed(4);
  p.cut();
  return p.build();
}

export function buildKitchenTicketBytes(d: ReceiptData): Uint8Array {
  const p = new EscPosBuilder();
  p.init();
  p.align("center").bold(true).doubleSize(true);
  p.text("PESANAN\n");
  p.doubleSize(false);
  p.text(`#${d.orderNumber}\n`);
  p.align("left");
  p.text(`${new Date(d.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false })}\n`);
  p.line("-");
  for (const it of d.items) {
    p.bold(true).doubleSize(true);
    p.wrap(`${it.quantity}x`);
    p.doubleSize(false).bold(false);
    p.wrap(it.name);
    p.line(".");
  }
  p.feed(4);
  p.cut();
  return p.build();
}
