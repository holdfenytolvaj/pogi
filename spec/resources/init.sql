-- drop tables
DROP TABLE IF EXISTS "users";
-- drop sequences
DROP SEQUENCE IF EXISTS "users_id_seq";
-- drop types
DROP TYPE IF EXISTS "membershipType";
DROP TYPE IF EXISTS "categoryType";
DROP TYPE IF EXISTS "permissionType";
DROP TYPE IF EXISTS "permissionForResourceType";

CREATE TYPE "membershipType" AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE "categoryType" AS ENUM ('sport', 'food', 'tech', 'music');
CREATE TYPE "permissionType" AS ENUM ('read', 'write', 'admin');
CREATE TYPE "permissionForResourceType" AS (
    "permission"    "permissionType",
    "resource"      "text"
);

CREATE SEQUENCE "users_id_seq";
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY NOT NULL DEFAULT ('us' || nextval('users_id_seq')::text || (LPAD(floor(random()*100)::text, 2, '0'))),
	"name" varchar UNIQUE NOT NULL,

	"textList" text[],
	"numberList" integer[], -- int4
	"bigNumberList" bigInt[],  -- int8
	"timestamptzList" timestamptz[],

	"membership" "membershipType",
    "favourites" "categoryType"[],

	"jsonList" jsonb,
	"jsonObject" jsonb,

	"permission" "permissionForResourceType",
	"permissionList" "permissionForResourceType"[],
	"updated" timestamp with time zone
);


CREATE OR REPLACE FUNCTION update_updated_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER "update_users_updated" BEFORE INSERT ON "users" FOR EACH ROW EXECUTE PROCEDURE __SCHEMA__.update_updated_column();
