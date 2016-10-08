![Image](https://www.flickr.com/photos/radicsge/29544431994) 

## PgDb 
**pgdb** is an easy to use postgreDB handler for javascript, built on top of [pg.js](https://github.com/brianc/node-postgres) 
(and inherited few things from [MassiveJS](https://github.com/robconery/massive-js)). Supporting connection pooling, transaction, 
typescript, async-await, custom logger, executable sql files and built with a lot of sensible default.

It is not a full-featured ORM, it is rather aligned with KISS. 
Therefore no initial definitions needed. It rather runs some initial queries
to look up the schemas and tablenames and some special column types at startup.
So makes a seemless integration with js objects and removes boiler plate but keeps 
the power of custom queries.

```js
import {PgDb} from "pgdb/lib/index";

let pgdb = await PgDb.connect({connectionString: "postgres://"});

let table = pgdb.schemas['test']['users'];

let c1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active:true});
let c2 = await table.count({active:true});
c1[0].c == c2; //true

let user = {..}
let userWithId = await table.insert(user);
```

## Why we need +1?
Since wanted to keep things simple, ORMs were out of consideration. pg.js on the other 
hand was too basic, still required a lot of boiler place. MassiveJs looked promising, but
there again too much restriction applied (no pool, no ts, no transaction, not mixing of 
standard fields and json, etc).

## Known pitfalls
### postgre data types vs javascript types - general
pg.js is a powerfull library but left many decision to the user, e.g. converting types. 
By default it doesn't convert arrays or integers, dates are also tricky. We've added some basic 
types, but rarely used types (e.g. date-ranges, custom complex types) still need to be converted.

### postgre data types vs javascript types - number
Javacript does not handle integers precisely out of range [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
and this is why it is not converted by default by pg.js, but its rarely reached,
thus it is safe to convert by default, and just throw an exception when it is above that number (9007199254740991); 

### postgre data types vs javascript types - date
TODO (write more) 

e.g. when you write your own queries, do not do this:
```js
let date = new Date().toISOString();
await pgdb.query(`SELECT * FROM users where created>'${date}'`);
```
this equals to (or something similar depending on your timezone):
```sql
select * from users where created>'1999-12-31T18:00:00.000Z';
```
it will have some sideeffect as postgre will compare them as a string, so you need to enforce the conversion:
```js
await pgdb.query(`SELECT * FROM users where created>'${date}'::timestamptz`);
//or 
await userTable.find({'created >':date});
await userTable.find({'created >': new Date()});//no need for toISOString()
```
this equals to:
```sql
select * from users where created>'2000-01-01 00:00:00';
```

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

### Connectivity(?)
See [pg-ka-fix](https://github.com/numminorihsf/pg-ka-fix). Haven't met with the issue,
but need to investigate, leave it here as a possible issue. 
