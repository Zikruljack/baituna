// apps/web/types/api.ts
//
// Hand-written response/request types for the UI modules that consume
// apps/web/server/api/**. apps/web/server/utils/openapi.ts has no
// components.schemas (descriptions only), so these are mirrored by hand from
// the actual service/route code, the same approach used in
// apps/web/lib/auth-types.ts for Module 1. Each module's implementation plan
// appends its own interfaces here — this file is never recreated wholesale.

/** Mirrors apps/web/server/services/region.service.ts RegionOption (Module 2). */
export interface RegionOption {
  id: string;
  name: string;
}

/** Mirrors apps/web/server/services/region.service.ts CityOption (Module 2). */
export interface CityOption extends RegionOption {
  provinceId: string;
}
