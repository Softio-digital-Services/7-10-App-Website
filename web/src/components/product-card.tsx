import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  category: string;
  inStock: boolean;
};

export function ProductCard({
  name,
  slug,
  price,
  originalPrice,
  discount = 0,
  imageUrl,
  category,
  inStock,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            {discount}% OFF
          </span>
        )}
        {!inStock && (
          <span className="absolute right-3 top-3 rounded-full bg-stone-900 px-2 py-1 text-xs text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">{category}</p>
        <h3 className="font-medium text-stone-900">{name}</h3>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-stone-900">${price.toFixed(2)}</p>
          {originalPrice && (
            <p className="text-sm text-red-500 line-through">${originalPrice.toFixed(2)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
