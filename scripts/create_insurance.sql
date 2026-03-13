-- Create insurance table
CREATE TABLE IF NOT EXISTS insurance (
    ins_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    policy_holder TEXT,
    polocy_number TEXT,
    entity_covered TEXT,
    policy_amt MONEY,
    intent TEXT,
    institution_url TEXT
);
