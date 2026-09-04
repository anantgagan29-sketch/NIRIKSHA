import type { Complaint } from "./types";

/** Complaints shown to citizens and in the authority console. */
export const COMPLAINTS: Complaint[] = [
  {
    id: "NIR-CMP-2026-00481",
    scanId: "NIR-2026-00123",
    product: "Grainwell Digestive Biscuits",
    violationType: "Missing consumer care details",
    description:
      "The pack carries no consumer care telephone number or e-mail address anywhere on the label, and the price is printed as a bare figure without stating that it is inclusive of all taxes. Bought at a general store in Karol Bagh, New Delhi.",
    location: "Karol Bagh, New Delhi",
    filedOn: "2026-09-03T17:02:00+05:30",
    status: "under_review",
    timeline: [
      { status: "submitted", at: "03 Sep 2026, 05:02 PM", note: "Complaint recorded in the NIRIKSHA system with the assessment findings attached." },
      { status: "under_review", at: "04 Sep 2026, 09:15 AM", note: "Picked up for verification against the label image." },
    ],
  },
  {
    id: "NIR-CMP-2026-00479",
    scanId: "NIR-2026-00120",
    product: "Nutrimix Breakfast Cereal",
    violationType: "Incomplete MRP declaration",
    description:
      "The maximum retail price is shown without the tax-inclusive wording the Rules prescribe. Purchased from a supermarket in Pune.",
    location: "Kothrud, Pune",
    filedOn: "2026-09-01T19:20:00+05:30",
    status: "verified",
    timeline: [
      { status: "submitted", at: "01 Sep 2026, 07:20 PM", note: "Complaint recorded in the NIRIKSHA system." },
      { status: "under_review", at: "02 Sep 2026, 10:30 AM", note: "Assigned for verification." },
      { status: "verified", at: "02 Sep 2026, 03:48 PM", note: "Price declaration confirmed to omit the tax statement." },
    ],
  },
  {
    id: "NIR-CMP-2026-00476",
    scanId: "NIR-2026-00116",
    product: "Crunchy Namkeen Mix",
    violationType: "Net quantity not declared",
    description:
      "No net quantity is printed on the front or back panel of the pack. Bought from a roadside vendor in Jaipur.",
    location: "Malviya Nagar, Jaipur",
    filedOn: "2026-08-30T18:05:00+05:30",
    status: "action_taken",
    timeline: [
      { status: "submitted", at: "30 Aug 2026, 06:05 PM", note: "Complaint recorded in the NIRIKSHA system." },
      { status: "under_review", at: "31 Aug 2026, 11:00 AM", note: "Assigned for verification." },
      { status: "verified", at: "31 Aug 2026, 04:20 PM", note: "Absence of a net quantity declaration confirmed." },
      { status: "action_taken", at: "02 Sep 2026, 12:10 PM", note: "Outcome recorded by the reviewing account." },
    ],
  },
];

export const VIOLATION_TYPES = [
  "Missing consumer care details",
  "Incomplete or missing MRP declaration",
  "Net quantity not declared",
  "Manufacturer or packer details missing",
  "Country of origin missing on an imported package",
  "Illegible or obscured declarations",
  "Other",
];
