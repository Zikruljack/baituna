import { and, asc, between, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../../drizzle/schema';
import { mosques } from '../../drizzle/schema';

export type Database = NodePgDatabase<typeof schema>;

export interface MosqueSummary {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  distanceKm?: number;
}

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

const EARTH_RADIUS_KM = 6_371;
const KILOMETERS_PER_DEGREE_LATITUDE = 110.574;
const BOUNDING_BOX_BUFFER_DEGREES = 1e-9;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  const clampedHaversine = Math.min(1, Math.max(0, haversine));

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(clampedHaversine), Math.sqrt(1 - clampedHaversine))
  );
}

/** Finds approved, active mosques in a circular radius around a public map position. */
export async function findNearbyMosques(
  db: Database,
  params: { lat: number; lng: number; radiusKm: number },
): Promise<MosqueSummary[]> {
  const latitudeDelta = params.radiusKm / KILOMETERS_PER_DEGREE_LATITUDE;
  const angularRadius = params.radiusKm / EARTH_RADIUS_KM;
  const latitudeCosine = Math.abs(Math.cos(toRadians(params.lat)));
  const longitudeDelta =
    Math.sin(angularRadius) >= latitudeCosine
      ? 180
      : (Math.asin(Math.sin(angularRadius) / latitudeCosine) * 180) / Math.PI +
        BOUNDING_BOX_BUFFER_DEGREES;
  const latitudeExpression = sql`${mosques.latitude}::double precision`;
  const longitudeExpression = sql`${mosques.longitude}::double precision`;
  const longitudeMinimum = params.lng - longitudeDelta;
  const longitudeMaximum = params.lng + longitudeDelta;
  const longitudeBounds =
    longitudeDelta === 180
      ? undefined
      : longitudeMinimum < -180
        ? or(
            between(longitudeExpression, longitudeMinimum + 360, 180),
            between(longitudeExpression, -180, longitudeMaximum),
          )
        : longitudeMaximum > 180
          ? or(
              between(longitudeExpression, longitudeMinimum, 180),
              between(longitudeExpression, -180, longitudeMaximum - 360),
            )
          : between(longitudeExpression, longitudeMinimum, longitudeMaximum);

  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
    })
    .from(mosques)
    .where(
      and(
        eq(mosques.status, 'approved'),
        isNull(mosques.deletedAt),
        between(
          latitudeExpression,
          Math.max(-90, params.lat - latitudeDelta),
          Math.min(90, params.lat + latitudeDelta),
        ),
        longitudeBounds,
      ),
    );

  const nearby: Array<MosqueSummary & { distanceKm: number }> = [];
  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const distanceKm = calculateDistanceKm(params.lat, params.lng, latitude, longitude);

    if (distanceKm <= params.radiusKm) {
      nearby.push({
        id: row.id,
        name: row.name,
        address: row.address,
        latitude,
        longitude,
        photoUrl: row.photoUrl,
        distanceKm,
      });
    }
  }

  return nearby.sort((left, right) => left.distanceKm - right.distanceKm);
}

/** Searches approved, active mosques by a public name or address keyword. */
export async function searchMosquesByKeyword(
  db: Database,
  keyword: string,
): Promise<MosqueSummary[]> {
  const pattern = `%${keyword}%`;
  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
    })
    .from(mosques)
    .where(
      and(
        eq(mosques.status, 'approved'),
        isNull(mosques.deletedAt),
        or(ilike(mosques.name, pattern), ilike(mosques.address, pattern)),
      ),
    )
    .orderBy(asc(mosques.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photoUrl: row.photoUrl,
  }));
}

/** Finds one public-safe mosque detail, without exposing unpublished records. */
export async function findApprovedMosqueById(
  db: Database,
  id: string,
): Promise<MosqueDetail | null> {
  const rows = await db
    .select({
      id: mosques.id,
      name: mosques.name,
      address: mosques.address,
      latitude: mosques.latitude,
      longitude: mosques.longitude,
      photoUrl: mosques.photoUrl,
      cityId: mosques.cityId,
      provinceId: mosques.provinceId,
      status: mosques.status,
      adminUserId: mosques.adminUserId,
    })
    .from(mosques)
    .where(
      and(
        eq(mosques.id, id),
        eq(mosques.status, 'approved'),
        isNull(mosques.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photoUrl: row.photoUrl,
    cityId: row.cityId,
    provinceId: row.provinceId,
    status: 'approved',
    adminUserId: row.adminUserId,
  };
}
