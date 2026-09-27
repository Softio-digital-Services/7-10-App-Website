export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  productName: string;
  size: string;
  color: string;
  price: number;
  compareAt: number | null;
  imageUrl: string;
  quantity: number;
  maxStock: number;
};

export type CheckoutItem = {
  variantId: string;
  quantity: number;
};
