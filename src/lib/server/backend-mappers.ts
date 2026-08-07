// backend.ts's proxy() already unwraps the { success, data } envelope AND
// recursively rekeys lea-be-core's snake_case to camelCase, so its output
// lines up field-for-field with this panel's types (src/lib/types.ts) for
// every implemented endpoint (users, counselors, subscriptions) — no mapper
// needed there anymore, route handlers use proxy()'s output directly.
//
// Counselor is the one exception: the backend's crisis_support field
// camelCases to crisisSupport, but Counselor's field is named `crisis`. That
// one real rename still needs to happen somewhere, so it lives here.

import type { Counselor } from "@/lib/types";

type CamelCasedCounselor = Omit<Counselor, "crisis"> & { crisisSupport: boolean };

export function mapCounselor(c: CamelCasedCounselor): Counselor {
  const { crisisSupport, ...rest } = c;
  return { ...rest, crisis: crisisSupport };
}
