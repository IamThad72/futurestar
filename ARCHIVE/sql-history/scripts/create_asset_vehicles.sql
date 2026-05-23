-- Create asset_vehicles table
CREATE TABLE IF NOT EXISTS asset_vehicles (
    vh_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year INTEGER,
    make TEXT,
    model TEXT,
    vin TEXT,
    value NUMERIC(12, 2),
    age INTEGER,
    description TEXT,
    trust_designated BOOLEAN NOT NULL DEFAULT false
);
