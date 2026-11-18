import type { Product } from "@/types";

export type ProductTier = {
  qty: number;
  product: Product;
};

export type ProductGroup = {
  key: string;
  displayName: string;
  description: string | null;
  imageUrl: string | null;
  isCombo: boolean;
  piecesPerUnit: number;
  tiers: ProductTier[];
  isActive: boolean;
  isRecommended: boolean;
  basePrice: number;
  stockTracking: boolean;
  stockQuantity: number;
  categoryId: string | null;
  categoryName: string | null;
};

export type CartDecomposition = {
  product: Product;
  qty: number;
};

function parseTier(name: string): { baseName: string; tier: number } {
  const m = name.match(/^(.+?)\s*\(x(\d+)\)\s*$/);
  if (m) return { baseName: m[1].trim(), tier: parseInt(m[2]) };
  return { baseName: name, tier: 1 };
}

export function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, { tier: number; product: Product }[]>();

  for (const p of products) {
    const { baseName, tier } = parseTier(p.name);
    if (!map.has(baseName)) map.set(baseName, []);
    map.get(baseName)!.push({ tier, product: p });
  }

  const groups: ProductGroup[] = [];

  for (const [baseName, items] of map) {
    const sorted = items.sort((a, b) => a.tier - b.tier);
    const isCombo = baseName.includes("&");
    const piecesPerUnit = isCombo ? (baseName.match(/&/g) ?? []).length + 1 : 1;
    const base = sorted[0].product;

    groups.push({
      key: baseName,
      displayName: baseName,
      description: base.description,
      imageUrl: base.image_url,
      isCombo,
      piecesPerUnit,
      tiers: sorted.map((s) => ({ qty: s.tier, product: s.product })),
      isActive: sorted.some((s) => s.product.is_active),
      isRecommended: sorted.some((s) => s.product.is_recommended),
      basePrice: base.selling_price,
      stockTracking: base.stock_tracking,
      stockQuantity: Math.min(...sorted.map((s) => s.product.stock_quantity)),
      categoryId: base.category_id,
      categoryName: base.category_name,
    });
  }

  return groups.sort((a, b) => {
    if (a.isCombo !== b.isCombo) return a.isCombo ? 1 : -1;
    if (a.piecesPerUnit !== b.piecesPerUnit) return a.piecesPerUnit - b.piecesPerUnit;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function decompose(group: ProductGroup, desiredQty: number): CartDecomposition[] {
  if (desiredQty <= 0) return [];

  const tiers = group.tiers;
  const tierQtys = tiers.map((t) => t.qty);
  const tierPrices = tiers.map((t) => t.product.selling_price);
  const n = desiredQty;

  const INF = Number.MAX_SAFE_INTEGER;
  const dp = new Array(n + 1).fill(INF);
  const from = new Array(n + 1).fill(-1);
  dp[0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let t = 0; t < tierQtys.length; t++) {
      if (tierQtys[t] <= i && dp[i - tierQtys[t]] < INF) {
        const cost = dp[i - tierQtys[t]] + tierPrices[t];
        if (cost < dp[i]) {
          dp[i] = cost;
          from[i] = t;
        }
      }
    }
  }

  if (dp[n] === INF) return [];

  const counts = new Array(tierQtys.length).fill(0);
  let rem = n;
  while (rem > 0) {
    counts[from[rem]]++;
    rem -= tierQtys[from[rem]];
  }

  return counts
    .map((c: number, t: number) => ({ product: tiers[t].product, qty: c }))
    .filter((d: CartDecomposition) => d.qty > 0);
}

export function calculatePrice(group: ProductGroup, desiredQty: number): number {
  return decompose(group, desiredQty).reduce(
    (sum, d) => sum + d.product.selling_price * d.qty,
    0
  );
}

export function getGroupQty(
  cartItems: { productId: string; quantity: number }[],
  group: ProductGroup
): number {
  const tierMap = new Map(group.tiers.map((t) => [t.product.id, t.qty]));
  return cartItems.reduce((sum, item) => {
    const tierQty = tierMap.get(item.productId);
    return tierQty !== undefined ? sum + tierQty * item.quantity : sum;
  }, 0);
}

export function getGroupQtyFromCart(
  cart: { product: { id: string }; quantity: number }[],
  group: ProductGroup
): number {
  const tierMap = new Map(group.tiers.map((t) => [t.product.id, t.qty]));
  return cart.reduce((sum, ci) => {
    const tierQty = tierMap.get(ci.product.id);
    return tierQty !== undefined ? sum + tierQty * ci.quantity : sum;
  }, 0);
}

export function formatBreakdown(group: ProductGroup, desiredQty: number): string {
  const items = decompose(group, desiredQty);
  if (items.length === 0) return "";
  if (items.length === 1 && items[0].qty === 1) {
    const tier = group.tiers.find((t) => t.product.id === items[0].product.id);
    if (tier && tier.qty === desiredQty) {
      return group.isCombo
        ? `${desiredQty} set`
        : `${desiredQty} pcs`;
    }
  }
  const parts = items.map((d) => {
    const tier = group.tiers.find((t) => t.product.id === d.product.id);
    const tq = tier?.qty ?? 1;
    return d.qty > 1 ? `${d.qty}×${group.isCombo ? `${tq}set` : `x${tq}`}` : `${group.isCombo ? `${tq}set` : `x${tq}`}`;
  });
  return parts.join(" + ");
}

export function maxTierQty(group: ProductGroup): number {
  return Math.max(...group.tiers.map((t) => t.qty));
}
