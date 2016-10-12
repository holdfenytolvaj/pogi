![Image](https://c3.staticflickr.com/6/5680/29544431994_954237c121_b.jpg) 

## pogi 
**pogi** is an easy to use PostgreSQL handler for javascript, built on top of [pg.js](https://github.com/brianc/node-postgres) 
(and inherited few things from [MassiveJS](https://github.com/robconery/massive-js)). Supporting connection pooling, transaction, 
typescript, async-await, assignable logger, stream, executable sql files and built with a lot of sensible default.

It is not a full-featured ORM, it is rather aligned with KISS. 
Therefore no initial definitions needed. It rather runs some initial queries
to look up the schemas and tablenames and some special column types at startup.
So makes a seamless integration with js objects and removes boiler plate but keeps 
the power of custom queries.

```js
import {PgDb} from "pogi";

let pgdb = await PgDb.connect({connectionString: "postgres://"});

let table = pgdb['test']['users']; //or pgdb.test.users if you generate the interface

let c1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active:true});
let c2 = await table.count({active:true});
c1[0].c == c2; //true

let user = {..}
let userWithId = await table.insert(user);
```

## Why we need +1?
Since wanted to keep things simple (and fully use Postgre), ORMs were out of consideration. pg.js on the other 
hand was too basic, still required a lot of boiler plate code. MassiveJs looked promising, but
there again too much restriction applied (no pool, no logger, no typescript, no transaction, no mixing of 
relational and jsonb columns (not safely at least), etc).
