-- Create real_estate table
CREATE TABLE IF NOT EXISTS real_estate (
    re_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    number TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    zipcode TEXT,
    value NUMERIC(12, 2),
    trust_designated BOOLEAN NOT NULL DEFAULT false
);
