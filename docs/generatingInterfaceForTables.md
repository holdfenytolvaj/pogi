#Generating interface for tables
You can easily generate interface for tables to facilitate code, just run
```bash
export PGUSER='test'
export PGPASSWORD='test'
export PGDATABASE='test'
#using PGUSER, PGPASSWORD and PGDATABASE env variables
node --harmony pgdb/lib/bin/generateInterface > testDbInterface.ts
```
It will generate something like:
```js 
import {PgDb, PgSchema, PgTable} from "pgdb/lib/index";

export interface PgDbType extends PgDb {
    'schemas': {
        'pgdb_test': pgdb_testSchemaType;
    }
}

export interface pgdb_testSchemaType extends PgSchema {
    users: PgTable;
}
```

So you can use it as 
```js
let pgdb = <PgDbType>await PgDb.connect({connectionString: "postgres://"});
let users = await pgdb.schemas.pgdb_test.users.findAll();
```
