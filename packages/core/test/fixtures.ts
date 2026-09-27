import type { Policy, SourceRecord } from "../src/types";

export function makeRecord(
  id: string,
  createdAt: string,
  updatedAt: string,
  fields: SourceRecord["fields"],
): SourceRecord {
  return { id, system: "test", createdAt, updatedAt, fields };
}

/** The canonical RevOps story: inbound form fill in 2023, cold-called in 2025. */
export const inboundLead = makeRecord(
  "lead-inbound",
  "2023-03-01T10:00:00Z",
  "2023-04-01T10:00:00Z",
  {
    email: "dana@acme.com",
    leadSource: "Web Form",
    originalForm: "Pricing Demo",
    utmCampaign: "q1-brand",
    sdrOwner: null,
    sequence: null,
    title: "Marketing Manager",
    lifecycleStage: "MQL",
    interests: ["Analytics"],
  },
);

export const outboundLead = makeRecord(
  "lead-outbound",
  "2025-02-10T09:00:00Z",
  "2025-02-20T09:00:00Z",
  {
    email: "dana@acme.com",
    leadSource: "Cold Call",
    originalForm: null,
    utmCampaign: null,
    sdrOwner: "Sam SDR",
    sequence: "Enterprise Q1",
    title: "VP Marketing",
    lifecycleStage: "SQL",
    interests: ["Integrations", "Analytics"],
  },
);

export const revopsPolicy: Policy = {
  channels: [
    { name: "inbound", when: [{ field: "leadSource", op: "in", values: ["Web Form", "Webinar"] }] },
    {
      name: "outbound",
      when: [{ field: "leadSource", op: "in", values: ["Cold Call", "Outbound"] }],
    },
  ],
  fields: {
    leadSource: { kind: "origin" },
    originalForm: { kind: "channel", channel: "inbound", pick: "earliest" },
    utmCampaign: { kind: "channel", channel: "inbound", pick: "earliest" },
    sdrOwner: { kind: "channel", channel: "outbound", pick: "latest" },
    sequence: { kind: "channel", channel: "outbound", pick: "latest" },
    title: { kind: "current" },
    lifecycleStage: { kind: "strongest", ranking: ["Customer", "SQL", "MQL", "Lead"] },
    interests: { kind: "combine" },
  },
};
