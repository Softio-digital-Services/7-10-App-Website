export function discountedPrice(price: number, discount: number) {
  if (discount <= 0) return price;
  return Math.round(price * (100 - discount)) / 100;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
