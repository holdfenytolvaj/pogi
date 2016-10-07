## What
**pgdb** is an easy to use postgreDB handler for javascript, built on top of pg.js 
(and inherited few things from Massive). Supporting connection pooling, transaction, 
typescript, async-await, custom logger, executable sql files and built with a lot of sensible default.

It is not a full-featured ORM, it is rather aligned with KISS. 
Therefore no initial definitions needed, rather it make some initial queries
to look up the schemas and tablenames and some special column types at startup.
So makes a seemless integration with js objects and removes boiler plate but keeps 
the power of custom queries.

```js
import {PgDb} from "pgdb/lib/index";

let pgdb = await PgDb.connect({connectionString: "postgres://"});

let table = pgdb.schemas['test']['users'];

let count1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active:true});
let count2 = await table.count({active:true});
count1[0].c == count2; //true

let user = {..}
let userWithId = await table.insert(user);
```

## Why
Since wanted to keep things simple, ORMs were out of consideration. pg.js on the other 
hand was too basic, still required a lot of boiler place. Massive looked promising, but
there again too much restriction applied (no pool, no ts, no transaction, not mixing of 
standard fields and json, etc).

## Known pitfalls
### postgre data types vs javascript types
pg.js is a powerfull library but left many decision to the user, e.g. converting types. 
By default it doesnt convert arrays or integers, dates are also tricky. We added some basic 
types, but rarely used types (e.g. date-ranges, custom complex types) still need to be converted.
Javacript does not handle integers precisely out of range Number.MAX_SAFE_INTEGER-MIN_SAFE_INTEGER,
and this is why it is not converted by default by pg.js, but its rarely reached,
thus it is safe to convert by default, and just throw an exception when it is above that number (9007199254740991); 

### Column type change / truncate
If a column type changes or truncates occur, the postgres data type's oid numbers might changes, after
these queries the pgdb need to rerun the initial column type queries. This can be done as easy as 
```js
pgdb.reload();
```

### Results' object constructor
Result objects have a special constructor that are not callable outside pg.js. 
It's rarely an issue, except e.g. if you use xlsx npm package, where after cloning 
the object, it calls the object's constructor it can cause some issues


