CREATE OR REPLACE FUNCTION LOWER(text[]) RETURNS text[] LANGUAGE SQL IMMUTABLE AS
$$
    SELECT array_agg(LOWER(value)) FROM unnest($1) value;
$$;
