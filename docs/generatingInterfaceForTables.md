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
import {PgDb, PgSchema, PgTable} from "pogi";

export interface PgDbType extends PgDb {
    'pgdb_test': PgSchema_pgdb_test;
    'schemas': {
        'pgdb_test': PgSchema_pgdb_test;
    }
}

export interface PgSchema_pgdb_test extends PgSchema {
    'users': PgTable;
    tables: {
        'users': PgTable;
    }
}
```

So you can use it as 
```js
let pgdb = <PgDbType>await PgDb.connect({connectionString: "postgres://"});
let users = await pgdb.pgdb_test.users.findAll();
```

If you want to help, you can add, the table definition generation as well, also to merge if schemas or tables have the same type.
