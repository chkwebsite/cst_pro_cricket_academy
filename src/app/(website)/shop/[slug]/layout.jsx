import db from "@/app/components/lib/db";

async function getProductMeta(slug) {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.product_name, p.slug, p.description, p.price, p.sale_price, c.category_name,
              (SELECT pi.image_path FROM cst_product_images pi WHERE pi.product_id = p.id AND pi.status = 1 AND pi.is_primary = 1 LIMIT 1) AS primary_image
       FROM cst_products p
       LEFT JOIN cst_categories c ON c.id = p.category_id
       WHERE (p.slug = ? OR p.id = ?) AND p.is_deleted = 0
       LIMIT 1`,
      [slug, slug]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("Error fetching product meta:", err);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductMeta(slug);

  if (!product) {
    return {
      title: "Product Not Found | CST Cricket Academy Pro Shop",
    };
  }

  const productName = product.product_name;
  const categoryName = product.category_name || "Cricket Gear";
  const desc = product.description
    ? product.description.replace(/<[^>]*>?/gm, "").slice(0, 160)
    : `Buy ${productName} online at CST Cricket Academy Pro Shop. Authentic quality cricket equipment.`;

  return {
    title: `${productName} | CST Cricket Academy Pro Shop`,
    description: desc,
    keywords: [
      productName,
      categoryName,
      "Buy Cricket Gear Online",
      "Cricket Equipment",
      "CST Cricket Academy Shop",
    ],
    openGraph: {
      title: `${productName} | CST Cricket Academy Pro Shop`,
      description: desc,
      images: product.primary_image ? [{ url: product.primary_image }] : [],
    },
  };
}

export default function ProductLayout({ children }) {
  return children;
}
