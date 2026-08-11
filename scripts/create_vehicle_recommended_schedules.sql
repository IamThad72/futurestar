-- Cached OEM recommended maintenance schedules keyed by year/make/model
CREATE TABLE IF NOT EXISTS vehicle_recommended_schedules (
    vrs_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year INTEGER NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local',
    raw_payload JSONB,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_recommended_schedules_ymm
    ON vehicle_recommended_schedules (year, lower(make), lower(model));

CREATE TABLE IF NOT EXISTS vehicle_recommended_services (
    vrsi_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vrs_id INTEGER NOT NULL REFERENCES vehicle_recommended_schedules(vrs_id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    interval_miles INTEGER,
    interval_months INTEGER,
    is_oem BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vehicle_recommended_services_vrs
    ON vehicle_recommended_services(vrs_id, sort_order);
