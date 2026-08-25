// apps/web/types/api.ts
//
// Hand-written response/request types for the UI modules that consume
// apps/web/server/api/**. apps/web/server/utils/openapi.ts has no
// components.schemas (descriptions only), so these are mirrored by hand from
// the actual service/route code, the same approach used in
// apps/web/lib/auth-types.ts for Module 1. Each module's implementation plan
// appends its own interfaces here — this file is never recreated wholesale.

// ---------------------------------------------------------------------------
// Module 2 — Region Reference
// Spec: docs/superpowers/specs/2026-08-23-module-2-region-reference.md
// ---------------------------------------------------------------------------

/** Mirrors apps/web/server/services/region.service.ts RegionOption (Module 2). */
export interface RegionOption {
  id: string;
  name: string;
}

/** Mirrors apps/web/server/services/region.service.ts CityOption (Module 2). */
export interface CityOption extends RegionOption {
  provinceId: string;
}

// ---------------------------------------------------------------------------
// Module 3 — Mosque Registration & Approval
// Spec: docs/superpowers/specs/2026-08-23-module-3-mosque-registration.md
// ---------------------------------------------------------------------------

/** Body for POST /api/mosques. latitude/longitude are strings, not numbers — see apps/web/server/utils/validation.ts latitudeSchema/longitudeSchema. */
export interface MosqueRegistrationInput {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  cityId: string;
  provinceId: string;
}

/** One fuzzy-duplicate candidate returned in POST /api/mosques's 201 response. Informational only — never blocks submission. */
export interface DuplicateWarning {
  id: string;
  name: string;
  address: string;
  distanceMeters: number;
  nameSimilarity: number;
}

/** Full 201 response body from POST /api/mosques. */
export interface CreatedMosqueRegistration {
  id: string;
  name: string;
  status: 'pending';
  duplicateWarning: DuplicateWarning[];
}

export type MosqueStatus = 'pending' | 'approved' | 'rejected';

/** One row from GET /api/mosques/pending (Super Admin only). */
export interface PendingMosque {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  submittedBy: string | null;
}

/** One row from GET /api/mosques/my-submissions. */
export interface MySubmission {
  id: string;
  name: string;
  status: MosqueStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Module 4 — Mosque Search & Detail
// Spec: docs/superpowers/specs/2026-08-23-module-4-mosque-search.md
// ---------------------------------------------------------------------------

/** Mirrors apps/web/server/services/mosque-search.service.ts MosqueSummary. `distanceKm` is present only from GET /mosques/nearby; absent from GET /mosques/search. */
export interface MosqueSummary {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  distanceKm?: number;
}

/** Mirrors apps/web/server/services/mosque-search.service.ts MosqueDetail. Returned only for status='approved' mosques — see GET /mosques/:id. */
export interface MosqueDetail {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  cityId: string;
  provinceId: string;
  status: 'approved';
  adminUserId: string | null;
}

// ---------------------------------------------------------------------------
// Module 5 — Person (Admin Panel)
// Spec: docs/superpowers/specs/2026-08-23-module-5-person.md
// ---------------------------------------------------------------------------

/** Shape returned by GET/POST/PATCH .../people(/:personId) — apps/web/server/services/person.service.ts PersonSummary. */
export interface Person {
  id: string;
  name: string;
  phone: string | null;
}

/** Body for POST /mosques/:id/people. phone omitted or null both mean "no phone". */
export interface CreatePersonInput {
  name: string;
  phone?: string | null;
}

/** Body for PATCH /mosques/:id/people/:personId. At least one field required (enforced by updatePersonSchema server-side). */
export interface UpdatePersonInput {
  name?: string;
  phone?: string | null;
}

// ---------------------------------------------------------------------------
// Module 6 — Friday Assignment
// Spec: docs/superpowers/specs/2026-08-23-module-6-friday-assignment.md
// ---------------------------------------------------------------------------

/** Mirrors AssignmentRecord in apps/web/server/services/friday-assignment.service.ts (Module 6). */
export interface FridayAssignment {
  id: string;
  mosqueId: string;
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

/**
 * Mirrors CurrentAssignment in apps/web/server/services/friday-assignment.service.ts.
 * Deliberately inconsistent naming: the `true` branch uses `assignmentDate`
 * (camelCase), the `false` branch uses `assignment_date` (snake_case) — this
 * matches the PRD's literal example payload and is documented as intentional
 * in the Module 6 backend plan. Do not "fix" this — narrow on `has_assignment`
 * before reading either date field.
 */
export type CurrentFridayAssignment =
  | {
      has_assignment: true;
      id: string;
      assignmentDate: string;
      khatibPersonId: string | null;
      imamPersonId: string | null;
      muazzinPersonId: string | null;
    }
  | { has_assignment: false; assignment_date: string };

/** Mirrors PaginatedAssignments in apps/web/server/services/friday-assignment.service.ts. */
export interface PaginatedAssignments {
  items: FridayAssignment[];
  page: number;
  pageSize: number;
  total: number;
}

/** Request body for POST /mosques/:id/friday-schedule — mirrors createAssignmentSchema in server/utils/validation.ts. */
export interface CreateAssignmentInput {
  assignmentDate: string;
  khatibPersonId: string | null;
  imamPersonId: string | null;
  muazzinPersonId: string | null;
}

/** Request body for PATCH /mosques/:id/friday-schedule/:assignmentId — mirrors updateAssignmentSchema in server/utils/validation.ts. At least one field required. */
export interface UpdateAssignmentInput {
  khatibPersonId?: string | null;
  imamPersonId?: string | null;
  muazzinPersonId?: string | null;
}
