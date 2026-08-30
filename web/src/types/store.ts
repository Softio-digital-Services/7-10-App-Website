export type CartItem = {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  price: number;
  imageUrl: string;
  quantity: number;
};

export type CheckoutItem = {
  variantId: string;
  quantity: number;
};

export type ProductWithVariants = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  variants: {
    id: string;
    size: string;
    color: string;
    stock: number;
  }[];
};
