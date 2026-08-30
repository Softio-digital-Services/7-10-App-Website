import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CUSTOMER" | "ADMIN";
    } & DefaultSession["user"];
  }
}

export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  size: string;
  color: string;
  price: number;
  imageUrl: string;
  quantity: number;
  stock: number;
};

export type CheckoutItem = {
  variantId: string;
  quantity: number;
};

export type SyncProduct = {
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
    inStock: boolean;
  }[];
};
