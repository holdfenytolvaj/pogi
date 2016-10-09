# pgdb
> What is your dream?

**pgdb** is a wrapper over [pg.js](https://github.com/brianc/node-postgres) to make life easier.
- it is not an overenginered ORM with new syntax to learn, 
- it is not a simple prepared statements executor with a lot of boilerplate for queries 

it is somewhere in between around the golden middle ground.

##Some of the features:
- typescript support (async-await!) (also can generate the structure for the db)
- transaction
- pools
- sql file execution
- BYOL - bring your own logger :) (db/schema/table/query level)
- encourage mixing jsonb and relational columns (arrays, complex types, enums etc) to get the full power!
- named parameters
- stream

so all the basics that you would expect in 2016.

##Documentation (includes why+1?)
[here](http://pgdb.readthedocs.io/en/latest/)

##Some example to get the taste
```js
import {PgDb} from "pgdb";

let pgdb = await PgDb.connect({connectionString: "postgres://"});

let table = pgdb['test']['users']; //or pgdb.test.users if you generate the interface

let c1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active:true});
let c2 = await table.count({active:true});
c1[0].c == c2; //true

await table.insert({name:'simply', permissions:['p','e','r'], props:{email:'f@e.ct'}});
let l = await table.find({'i ~':'ke.*', 'a @>':{'d':{'r':'e'}}, 'm @>':['!']}); 

```

##It's not without pitfalls
What is? It's just usually not written (definitely not in the front page), but see more in the [docs](http://pgdb.readthedocs.io/en/latest/).
I wish more project would be honest about it to save a lot of hours for others. If you find more,
don't hesitate to tell us!
