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
