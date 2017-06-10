![Image](https://c3.staticflickr.com/6/5680/29544431994_954237c121_b.jpg) 

## pogi 
**pogi** is an easy to use PostgreSQL handler for javascript, built on top of [pg.js](https://github.com/brianc/node-postgres) 
(and inherited few things from [MassiveJS](https://github.com/robconery/massive-js)). Supporting connection pooling, transaction, 
typescript, async-await, assignable logger, stream, executable sql files and what not, top of that with a lot of sensible default.

It is not a full-featured ORM, it is rather aligned with KISS. 
Therefore no initial definitions are needed. It rather issues some initial queries at startup
to look up the schemas, tablenames and some special column types.
Aim to makes a seamless integration with js objects and removes boiler plate code but keeps 
the power of custom queries.

```js
import {PgDb} from "pogi";

(async()=> {
    let pgdb = await PgDb.connect({connectionString: "postgres://"});
    
    let table = pgdb['test']['users']; //or pgdb.test.users if you generate the interface
    
    let c1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active: true});
    let c2 = await table.count({active: true});
    c1[0].c == c2 //true
    
    let user = {name: 'admin'}
    await table.insert(user);
    
    await table.update({id: 1}, user);
    
    let res = await table.find({id: [1,2,3]});
    ...
    
})().catch(console.error)
```

Typescript should get typing definition from npm package, but if doesn't you can add with typings:
```sh 
typings install pogi=github:holdfenytolvaj/pogi/lib/index.d.ts --save
```

## Why we need +1?
Since wanted to keep things simple (and use Postgre full power as much as possible), ORMs were out of consideration. pg.js on the other 
hand was too basic, still required a lot of boiler plate code. MassiveJs looked promising, but
there again too much restriction applied (no pool, no logger, no typescript, no transaction, no mixing of 
relational and jsonb columns (not safely at least), etc) and adding these were not possible without redesign.
