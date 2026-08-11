type DbClient = {
  query: (
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

export type RecommendedService = {
  vrsi_id?: number;
  service_name: string;
  interval_miles: number | null;
  interval_months: number | null;
  is_oem: boolean;
  sort_order: number;
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeYmm(year: number, make: string, model: string) {
  return {
    year: Number(year),
    make: String(make || "").trim(),
    model: String(model || "").trim(),
  };
}

async function loadCached(
  client: DbClient,
  year: number,
  make: string,
  model: string,
): Promise<{ vrsId: number; fetchedAt: Date; source: string; services: RecommendedService[] } | null> {
  const schedule = await client.query(
    `SELECT vrs_id, fetched_at, source
     FROM vehicle_recommended_schedules
     WHERE year = $1 AND lower(make) = lower($2) AND lower(model) = lower($3)
     LIMIT 1`,
    [year, make, model],
  );
  const row = schedule.rows[0];
  if (!row) return null;
  const vrsId = Number(row.vrs_id);
  const fetchedAt = new Date(String(row.fetched_at));
  const servicesRes = await client.query(
    `SELECT vrsi_id, service_name, interval_miles, interval_months, is_oem, sort_order
     FROM vehicle_recommended_services
     WHERE vrs_id = $1
     ORDER BY sort_order ASC, interval_miles ASC NULLS LAST, service_name ASC`,
    [vrsId],
  );
  return {
    vrsId,
    fetchedAt,
    source: String(row.source || "local"),
    services: servicesRes.rows.map((r) => ({
      vrsi_id: Number(r.vrsi_id),
      service_name: String(r.service_name),
      interval_miles: r.interval_miles != null ? Number(r.interval_miles) : null,
      interval_months: r.interval_months != null ? Number(r.interval_months) : null,
      is_oem: Boolean(r.is_oem),
      sort_order: Number(r.sort_order) || 0,
    })),
  };
}

async function saveCache(
  client: DbClient,
  year: number,
  make: string,
  model: string,
  source: string,
  services: RecommendedService[],
) {
  await client.query("BEGIN");
  try {
    const existing = await client.query(
      `SELECT vrs_id FROM vehicle_recommended_schedules
       WHERE year = $1 AND lower(make) = lower($2) AND lower(model) = lower($3)
       LIMIT 1`,
      [year, make, model],
    );
    let vrsId: number;
    const payload = JSON.stringify({ source, generated_at: new Date().toISOString(), count: services.length });
    if (existing.rows[0]) {
      vrsId = Number(existing.rows[0].vrs_id);
      await client.query(
        `UPDATE vehicle_recommended_schedules
         SET source = $1, raw_payload = $2::jsonb, fetched_at = NOW(), make = $3, model = $4
         WHERE vrs_id = $5`,
        [source, payload, make, model, vrsId],
      );
      await client.query(`DELETE FROM vehicle_recommended_services WHERE vrs_id = $1`, [vrsId]);
    } else {
      const inserted = await client.query(
        `INSERT INTO vehicle_recommended_schedules (year, make, model, source, raw_payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING vrs_id`,
        [year, make, model, source, payload],
      );
      vrsId = Number(inserted.rows[0].vrs_id);
    }

    for (const svc of services) {
      await client.query(
        `INSERT INTO vehicle_recommended_services
          (vrs_id, service_name, interval_miles, interval_months, is_oem, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vrsId, svc.service_name, svc.interval_miles, svc.interval_months, svc.is_oem, svc.sort_order],
      );
    }
    await client.query("COMMIT");
    return vrsId;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  }
}

/**
 * Returns recommended services for a year/make/model from a local schedule library.
 * No third-party network calls; results are cached in Postgres.
 */
export async function getRecommendedServicesForVehicle(
  client: DbClient,
  vehicle: { year?: unknown; make?: unknown; model?: unknown },
): Promise<{ services: RecommendedService[]; source: string | null; unavailableReason: string | null }> {
  const year = Number(vehicle.year);
  const make = String(vehicle.make ?? "").trim();
  const model = String(vehicle.model ?? "").trim();
  if (!Number.isFinite(year) || !make || !model) {
    return {
      services: [],
      source: null,
      unavailableReason: "Vehicle year, make, and model are required for a schedule.",
    };
  }

  const ymm = normalizeYmm(year, make, model);
  const { buildLocalRecommendedSchedule } = await import("./localMaintenanceSchedules");
  const built = buildLocalRecommendedSchedule(ymm.year, ymm.make, ymm.model);
  const cached = await loadCached(client, ymm.year, ymm.make, ymm.model);
  const fresh =
    cached &&
    Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS &&
    cached.source === built.source &&
    cached.services.length > 0;
  if (fresh) {
    return { services: cached.services, source: cached.source, unavailableReason: null };
  }

  try {
    const services: RecommendedService[] = built.services.map((svc, i) => ({
      ...svc,
      sort_order: i,
    }));
    await saveCache(client, ymm.year, ymm.make, ymm.model, built.source, services);
    const reloaded = await loadCached(client, ymm.year, ymm.make, ymm.model);
    return {
      services: reloaded?.services ?? services,
      source: built.source,
      unavailableReason: null,
    };
  } catch {
    if (cached?.services?.length) {
      return { services: cached.services, source: cached.source, unavailableReason: null };
    }
    return {
      services: [],
      source: null,
      unavailableReason: "Schedule unavailable. Local recommended plan could not be generated.",
    };
  }
}
