-- User-entered completed vehicle service records
CREATE TABLE IF NOT EXISTS vehicle_service_records (
    vsr_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vh_id INTEGER NOT NULL REFERENCES asset_vehicles(vh_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    service_date DATE NOT NULL,
    mileage INTEGER,
    cost NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_service_records_vh
    ON vehicle_service_records(vh_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_records_user
    ON vehicle_service_records(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_records_group
    ON vehicle_service_records(group_id) WHERE group_id IS NOT NULL;
