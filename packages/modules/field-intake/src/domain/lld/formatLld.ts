import type { LldComponents } from "../../contracts/LldComponents";

export function formatLld(components: LldComponents) {
  return `${components.quarter}-${String(components.section).padStart(2, "0")}-${String(
    components.township,
  ).padStart(3, "0")}-${String(components.range).padStart(2, "0")}-W${components.meridian}`;
}
