import type { Product } from "@/types";

export type ProductTier = {
  qty: number;
  price: number;
};

export type ProductGroup = {
  key: string;
  displayName: string;
  description: string | null;
  imageUrl: string | null;
  isCombo: boolean;
  piecesPerUnit: number;
  tiers: ProductTier[];
  product: Product;
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

function buildTiers(product: Product): ProductTier[] {
  const tp = product.tier_prices;
  if (!tp || Object.keys(tp).length === 0) {
    return [{ qty: 1, price: product.selling_price }];
  }
  const tiers: ProductTier[] = [];
  for (const [k, v] of Object.entries(tp)) {
    const q = parseInt(k);
    if (q > 0 && v > 0) tiers.push({ qty: q, price: v });
  }
  tiers.sort((a, b) => a.qty - b.qty);
  return tiers.length > 0 ? tiers : [{ qty: 1, price: product.selling_price }];
}

export function groupProducts(products: Product[]): ProductGroup[] {
  return products.map((p) => {
    const isCombo = p.name.includes(" & ");
    const piecesPerUnit = isCombo ? (p.name.match(/&/g) ?? []).length + 1 : 1;
    const tiers = buildTiers(p);

    return {
      key: p.id,
      displayName: p.name,
      description: p.description,
      imageUrl: p.image_url,
      isCombo,
      piecesPerUnit,
      tiers,
      product: p,
      isActive: p.is_active,
      isRecommended: p.is_recommended,
      basePrice: tiers[0]?.price ?? p.selling_price,
      stockTracking: p.stock_tracking,
      stockQuantity: p.stock_quantity,
      categoryId: p.category_id,
      categoryName: p.category_name,
    };
  }).sort((a, b) => {
    if (a.isCombo !== b.isCombo) return a.isCombo ? 1 : -1;
    if (a.piecesPerUnit !== b.piecesPerUnit) return a.piecesPerUnit - b.piecesPerUnit;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function calculatePrice(group: ProductGroup, desiredQty: number): number {
  if (desiredQty <= 0) return 0;
  const tiers = group.tiers;
  const INF = Number.MAX_SAFE_INTEGER;
  const dp = new Array(desiredQty + 1).fill(INF);
  dp[0] = 0;

  for (let i = 1; i <= desiredQty; i++) {
    for (const t of tiers) {
      if (t.qty <= i && dp[i - t.qty] < INF) {
        const cost = dp[i - t.qty] + t.price;
        if (cost < dp[i]) dp[i] = cost;
      }
    }
  }

  if (dp[desiredQty] === INF) {
    return group.product.selling_price * desiredQty;
  }
  return dp[desiredQty];
}

export function decompose(group: ProductGroup, desiredQty: number): CartDecomposition[] {
  if (desiredQty <= 0) return [];
  return [{ product: group.product, qty: desiredQty }];
}

export function getGroupQty(
  cartItems: { productId: string; quantity: number }[],
  group: ProductGroup
): number {
  const item = cartItems.find((i) => i.productId === group.product.id);
  return item?.quantity ?? 0;
}

export function getGroupQtyFromCart(
  cart: { product: { id: string }; quantity: number }[],
  group: ProductGroup
): number {
  const item = cart.find((ci) => ci.product.id === group.product.id);
  return item?.quantity ?? 0;
}

export function formatBreakdown(group: ProductGroup, desiredQty: number): string {
  if (desiredQty <= 0) return "";
  const unit = group.isCombo ? "set" : "pcs";
  return `${desiredQty} ${unit}`;
}

export function maxTierQty(group: ProductGroup): number {
  return Math.max(...group.tiers.map((t) => t.qty));
}
