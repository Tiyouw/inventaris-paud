-- Add school_id column to zones table for multi-school zone isolation
ALTER TABLE zones ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Create index on zones(school_id) for faster lookups
CREATE INDEX IF NOT EXISTS idx_zones_school_id ON zones(school_id);

-- Drop the existing unique constraint on slug if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_slug_key' AND conrelid = 'zones'::regclass
  ) THEN
    ALTER TABLE zones DROP CONSTRAINT zones_slug_key;
  END IF;
END $$;

-- Create composite unique index on (slug, school_id) using COALESCE for nullable school_id
CREATE UNIQUE INDEX IF NOT EXISTS zones_slug_school_id_unique
  ON zones (slug, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'));
