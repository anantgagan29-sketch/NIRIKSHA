/**
 * Which declarations an inspection is about.
 *
 * The names here are the backend's own; sending anything else means the
 * server drops it and assesses everything, which is safe but not what the
 * person asked for. The backend re-validates regardless — this list is for
 * building the interface, not for deciding what runs.
 */

export interface SelectableField {
  id: string;
  label: string;
  /** What the check actually looks for, in the words on a pack. */
  hint: string;
}

export const SELECTABLE_FIELDS: SelectableField[] = [
  { id: "product_name", label: "Product Name", hint: "Common or generic name" },
  { id: "manufacturer", label: "Manufacturer", hint: "Name and address of manufacturer, packer or importer" },
  { id: "mrp", label: "MRP / Price", hint: "Retail sale price, inclusive of all taxes" },
  { id: "manufacturing_date", label: "Manufacturing Date", hint: "MFG, MFD, PKD or packing date" },
  { id: "expiry_date", label: "Expiry Date", hint: "EXP, use by, or best before" },
  { id: "batch_number", label: "Batch / Lot Number", hint: "Batch, lot or code number" },
  { id: "net_quantity", label: "Net Quantity", hint: "Weight, volume or count" },
];

export const ALL_FIELD_IDS = SELECTABLE_FIELDS.map((field) => field.id);

/**
 * True when the selection is every field.
 *
 * Everything selected is the same request as nothing selected, and the
 * backend treats them identically — so the interface can offer "All Fields"
 * as a single control without the two paths diverging.
 */
export function isAllFields(selection: string[]): boolean {
  return selection.length === ALL_FIELD_IDS.length;
}

/**
 * What to send with a scan.
 *
 * Undefined for "everything", which is exactly what every request made before
 * this feature sent, and what the server has always taken to mean the whole
 * assessment.
 */
export function selectionForRequest(selection: string[]): string[] | undefined {
  if (selection.length === 0 || isAllFields(selection)) return undefined;
  return selection;
}

export function labelFor(id: string): string {
  return SELECTABLE_FIELDS.find((field) => field.id === id)?.label ?? id;
}


/**
 * The extracted declarations each selection covers.
 *
 * Mirrors the backend's own table. A report showing every value it read,
 * under a heading naming one declaration, is the same failure as showing
 * every requirement: it answers questions nobody asked.
 */
const FIELD_VALUE_KEYS: Record<string, string[]> = {
  product_name: ["product_name", "brand"],
  manufacturer: ["manufacturer", "packer", "address"],
  mrp: ["mrp", "unit_sale_price"],
  manufacturing_date: ["manufacturing_date", "packing_date"],
  expiry_date: ["expiry_date", "best_before", "shelf_life"],
  batch_number: ["batch_number"],
  net_quantity: ["net_quantity"],
};

/**
 * Which extracted values belong to a selection. Null means all of them.
 *
 * Null is what an assessment that covered everything returns, and what every
 * scan recorded before selections existed returns — so a caller that filters
 * on this shows the whole reading for those, unchanged.
 */
export function valueKeysFor(selection: string[] | null | undefined): Set<string> | null {
  if (!selection || selection.length === 0) return null;

  const keys = new Set<string>();
  for (const field of selection) {
    for (const key of FIELD_VALUE_KEYS[field] ?? []) keys.add(key);
  }
  return keys.size ? keys : null;
}

/** The declarations a report should show, given what it was asked about. */
export function fieldsForSelection<T extends { key: string }>(
  fields: T[],
  selection: string[] | null | undefined,
): T[] {
  const keys = valueKeysFor(selection);
  if (!keys) return fields;

  const kept = fields.filter((field) => keys.has(field.key));
  // A selection whose declarations were all absent from the reading would
  // otherwise render an empty block; showing the reading is better than
  // showing nothing.
  return kept.length ? kept : fields;
}
