import type { ScanRecord } from "./types";

/** Scan history shown on the History page and the dashboard's recent list. */
export const SCAN_HISTORY: ScanRecord[] = [
  { scanId: "NIR-2026-00124", productId: "sunflower-oil", product: "Suryodaya Sunflower Oil", category: "Edible oil", result: "compliant", score: 100, date: "2026-09-04T10:24:00+05:30", relative: "Today, 10:24 AM" },
  { scanId: "NIR-2026-00123", productId: "digestive-biscuits", product: "Grainwell Digestive Biscuits", category: "Bakery", result: "non_compliant", score: 68, date: "2026-09-03T16:15:00+05:30", relative: "Yesterday, 04:15 PM" },
  { scanId: "NIR-2026-00122", productId: "herbal-shampoo", product: "Vanaspati Herbal Shampoo", category: "Personal care", result: "needs_review", score: 79, date: "2026-09-02T11:10:00+05:30", relative: "2 days ago, 11:10 AM" },
  { scanId: "NIR-2026-00121", productId: "sunflower-oil", product: "Aarogya Turmeric Powder", category: "Spices", result: "compliant", score: 100, date: "2026-09-02T09:02:00+05:30", relative: "2 days ago, 09:02 AM" },
  { scanId: "NIR-2026-00120", productId: "digestive-biscuits", product: "Nutrimix Breakfast Cereal", category: "Packaged food", result: "non_compliant", score: 72, date: "2026-09-01T18:40:00+05:30", relative: "3 days ago, 06:40 PM" },
  { scanId: "NIR-2026-00119", productId: "sunflower-oil", product: "Himgiri Basmati Rice 5 kg", category: "Staples", result: "compliant", score: 100, date: "2026-09-01T14:22:00+05:30", relative: "3 days ago, 02:22 PM" },
  { scanId: "NIR-2026-00118", productId: "herbal-shampoo", product: "Kesari Hair Oil", category: "Personal care", result: "needs_review", score: 81, date: "2026-08-31T12:05:00+05:30", relative: "4 days ago, 12:05 PM" },
  { scanId: "NIR-2026-00117", productId: "sunflower-oil", product: "Dairy Fresh Ghee 500 g", category: "Dairy", result: "compliant", score: 100, date: "2026-08-31T10:48:00+05:30", relative: "4 days ago, 10:48 AM" },
  { scanId: "NIR-2026-00116", productId: "digestive-biscuits", product: "Crunchy Namkeen Mix", category: "Snacks", result: "non_compliant", score: 64, date: "2026-08-30T17:30:00+05:30", relative: "5 days ago, 05:30 PM" },
  { scanId: "NIR-2026-00115", productId: "sunflower-oil", product: "Everclean Dishwash Bar", category: "Household", result: "compliant", score: 100, date: "2026-08-30T15:12:00+05:30", relative: "5 days ago, 03:12 PM" },
  { scanId: "NIR-2026-00114", productId: "sunflower-oil", product: "Morning Blend Tea 250 g", category: "Beverages", result: "compliant", score: 100, date: "2026-08-29T11:00:00+05:30", relative: "6 days ago, 11:00 AM" },
  { scanId: "NIR-2026-00113", productId: "digestive-biscuits", product: "Choco Delight Wafers", category: "Confectionery", result: "non_compliant", score: 70, date: "2026-08-29T09:35:00+05:30", relative: "6 days ago, 09:35 AM" },
];

/** Headline counts for the dashboard and history stat row. */
export const SCAN_STATS = {
  inspected: 24,
  compliant: 18,
  nonCompliant: 4,
  needsReview: 2,
  complaints: 3,
};
