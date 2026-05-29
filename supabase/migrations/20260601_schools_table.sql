-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  access_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed 5 schools with ON CONFLICT safety
INSERT INTO schools (name, access_code)
VALUES
  ('TK Dewi Masyithoh 69 Keting', '69'),
  ('TK Dewi Masyithoh 59 Jombang', '59'),
  ('TK DARUTTAQWA Jombang', '01'),
  ('TK Dewi Masyithoh 15 Keting', '15'),
  ('TK Dharma Wanita 02 Padomasan', '02')
ON CONFLICT (name) DO NOTHING;

-- Add school_id to items table (nullable for backward compatibility)
ALTER TABLE items ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

-- Add index on items(school_id)
CREATE INDEX IF NOT EXISTS idx_items_school_id ON items(school_id);
