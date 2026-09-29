/**
 * AD Notations 1.6.0 imports this historical subpath. Remix loads its UMD
 * bundle with the global Decimal from break_infinity.js 2.2.0 instead, so the
 * ESM build is routed through Beyond's same pinned compatibility facade.
 */
export { Decimal as default } from "@idle-mine-beyond/core";
