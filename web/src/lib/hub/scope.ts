/**
 * What may pass through this website. Business data (sales, costs, expenses, suppliers, staff, the shop's
 * customer list...) stays on the shop's admin PC and is refused here, even if a laptop sent it.
 *
 * - PUBLISHED: the public catalogue, sent by the admin PC (one way: PC -> website).
 * - WEBSITE: created on the website by customers themselves; the admin PC fetches it.
 */
export const PUBLISHED_TABLES = new Set([
  "categories",
  "parts",
  "product_images",
  "promotions",
  "promotion_items",
  "site_settings",
  "site_media",
  "site_reviews",
]);

/** Website accounts and addresses; the admin PC may edit them (e.g. fix an address), so they go both ways. */
export const WEBSITE_TABLES = new Set(["customers", "web_accounts", "web_addresses"]);

/** Tables a laptop may send. customers is not here: the shop's customer list never leaves the PC. */
export const ACCEPTED_FROM_LAPTOP = new Set([...PUBLISHED_TABLES, "web_accounts", "web_addresses"]);

/**
 * Columns kept per table (anything else, e.g. cost or supplier, is dropped on arrival).
 * Tables not listed keep every column.
 */
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  parts: new Set([
    "part_name", "part_number", "description", "selling_price", "category_id", "part_image", "status",
    "is_inactive", "is_sales_item", "item_type", "date_deleted", "size", "color", "style_code", "gender",
    "fabric", "collection", "is_new", "web_stock",
  ]),
  categories: new Set(["category_name", "category_name_ar", "category_image", "sort_order", "description"]),
  product_images: new Set(["part_id", "image_path", "sort_order"]),
};

/** Strips columns a table is not allowed to carry. */
export function allowedData(tbl: string, data: Record<string, unknown> | null | undefined) {
  const keep = ALLOWED_COLUMNS[tbl];
  if (!keep || !data) return data;
  return Object.fromEntries(Object.entries(data).filter(([k]) => keep.has(k)));
}
