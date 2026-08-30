import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ProductDetail } from "@/components/product-detail";
import { CommentSection } from "@/components/comment-section";

type PageProps = { params: Promise<{ slug: string }> };

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  const product = await prisma.product.findFirst({
    where: { OR: [{ slug }, { id: slug }], active: true },
    include: {
      variants: true,
      categoryRef: true,
      comments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <ProductDetail
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          discount: product.discount,
          description: product.description,
          imageUrl: product.imageUrl,
          category: product.categoryRef?.name ?? product.category,
          variants: product.variants,
        }}
        isLoggedIn={!!session?.user}
        userEmail={session?.user?.email}
      />
      <CommentSection
        productId={product.id}
        initialComments={product.comments.map((comment) => ({
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
