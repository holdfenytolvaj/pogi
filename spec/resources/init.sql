SET search_path TO __SCHEMA__;
DROP FUNCTION IF EXISTS list_gold_users();
DROP FUNCTION IF EXISTS increment();

-- drop tables
DROP VIEW IF EXISTS "users_view";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "groups";
DROP TABLE IF EXISTS "types";
-- drop sequences
DROP SEQUENCE IF EXISTS "users_id_seq";
-- drop types
DROP TYPE IF EXISTS __SCHEMA__."membershipType";
DROP TYPE IF EXISTS __SCHEMA__."categoryType";
DROP TYPE IF EXISTS __SCHEMA__."permissionForResourceType";
DROP TYPE IF EXISTS __SCHEMA__."permissionType";

DROP FUNCTION IF EXISTS update_tsv();


CREATE TYPE __SCHEMA__."membershipType" AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE __SCHEMA__."categoryType" AS ENUM ('sport', 'food', 'tech', 'music');
CREATE TYPE __SCHEMA__."permissionType" AS ENUM ('read', 'write', 'admin');
CREATE TYPE __SCHEMA__."permissionForResourceType" AS (
    "permission"    "permissionType",
    "resource"      "text"
);

CREATE TABLE IF NOT EXISTS "groups" (
	"id" SERIAL PRIMARY KEY,
	"name" varchar UNIQUE NOT NULL
);

CREATE SEQUENCE "users_id_seq";
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY NOT NULL DEFAULT ('us' || nextval('users_id_seq')::text || (LPAD(floor(random()*100)::text, 2, '0'))),
	"name" varchar UNIQUE NOT NULL,
    "aCategory" varchar,

	"textList" text[],
	"jsonbList" jsonb[],
	"numberList" integer[], -- int4
	"bigNumberList" bigInt[],  -- int8
	"timestamptzList" timestamptz[],

	"membership" "membershipType",
    "favourites" "categoryType"[],

	"jsonList" jsonb,
	"jsonObject" jsonb,
    "mainGroup" integer REFERENCES groups(id),
	"permission" "permissionForResourceType",
	"permissionList" "permissionForResourceType"[],

	"tsv" tsvector,
	"updated" timestamp with time zone,
	"created" timestamp,
	"createdtz" timestamptz
);

CREATE TABLE IF NOT EXISTS "types" (
	"text" varchar,
	"int" integer,
	"bigInt" bigInt,
	"real" real,
	"double" float8,
	"bool" boolean,
	"json" json,
	"jsonB" jsonb,
	"timestamptz" timestamptz,

	"arrayText" varchar[],
	"arrayInt" integer[],
	"arrayBigInt" bigInt[],
	"arrayReal" real[],
	"arrayDouble" float8[],
	"arrayBool" boolean[],
	"arrayJson" json[],
	"arrayJsonB" jsonb[],
	"arrayTimestamptz" timestamptz[]
);


CREATE OR REPLACE FUNCTION update_updated_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER "update_users_updated" BEFORE INSERT ON "users" FOR EACH ROW EXECUTE PROCEDURE __SCHEMA__.update_updated_column();

CREATE OR REPLACE FUNCTION list_gold_users()
RETURNS SETOF varchar AS $$
    SELECT name FROM __SCHEMA__.users WHERE membership = 'gold';
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION increment(i INT)
RETURNS INT AS $$
BEGIN
  RETURN i + 1;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_tsv() RETURNS trigger AS $$
begin
  new.tsv :=
     setweight(to_tsvector('pg_catalog.english', coalesce(new.name,'')), 'A') ||
     setweight(to_tsvector('pg_catalog.english', coalesce(new."aCategory",'')), 'B') ||
     setweight(to_tsvector('pg_catalog.english', coalesce(new."jsonList"::text,'')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tsv BEFORE INSERT OR UPDATE ON __SCHEMA__."users" FOR EACH ROW EXECUTE PROCEDURE update_tsv();

CREATE OR REPLACE FUNCTION LOWER(text[]) RETURNS text[] LANGUAGE SQL IMMUTABLE AS
$$
    SELECT array_agg(LOWER(value)) FROM unnest($1) value;
$$;

CREATE OR REPLACE VIEW users_view AS SELECT * FROM users;
