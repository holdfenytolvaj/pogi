# pogi
> What is your dream?

**pogi** is a wrapper over [pg.js](https://github.com/brianc/node-postgres) to make life easier.
- it is not an over engineered ORM with new syntax to learn and with less functionality, 
- it is not a simple prepared statements executor with a lot of boilerplate for queries 

it is somewhere in between, around the _golden_ middle ground.

##Some of the features:
- typescript support (async-await!) (also can generate the structure for the db)
- transaction support
- connection pooling
- sql file execution
- BYOL - bring your own logger :) (db/schema/table/query level)
- encourage mixing jsonb and relational columns (arrays, complex types, enums etc) to get the full power!
- named parameters for queries
- stream support

so all the basics that you would expect in 2016.

##Install
```js
npm install pogi --save
```

##Documentation (includes why+1?)
[here](http://pogi.readthedocs.io/en/latest/)

[Our experience on migrating from mongo](https://hackernoon.com/javascript-experience-of-migrating-from-mongodb-to-postgresql-21f8bf140c05#.k4d7hqsv2)


##Some examples to get the taste
```js
import {PgDb} from "pogi";

let pgdb = await PgDb.connect({connectionString: "postgres://"});

let table = pgdb['test']['users']; //or pgdb.test.users if you generate the interface

let c1 = await pgdb.query(`SELECT COUNT(*) as c FROM ${table} WHERE active=:active`, {active:true});
let c2 = await table.count({active:true});
c1[0].c == c2; //true

//mix json and relational columns (e.g. enumerations)
await table.insert({name:'simply', permissions:['r','w','e'], props:{email:'undefined@dev.null'}});

let rows;

//use the same operators as in postgre
rows = await table.find({'name ~':'Jo.*',                                  //regexp
                         'jsoncolumn @>':{'dream':{'change':'the world'}}, //contains
                         'arraycolumn @>':['up', 'down']});                //contains  

//will be transformed to "select * from test.users where id in (1,2,3)"
rows = await table.find({id:[1,2,3]});

//easy fallback 
rows = await table.findWhere('"happyWife"="happyLife" and name=:name', {name:'me'});

//convenient functions
let power = await pgdb.queryOneField('SELECT MAX(power) FROM magical.dbhandlers');
power; //>9000

//much more!

```

##It's not without pitfalls
What is? It's just usually not written (definitely not in the front page), but see more in the [docs](http://pogi.readthedocs.io/en/latest/).
I wish more project would be honest about it to save a lot of hours for others. If you find more,
don't hesitate to tell us!

##Contributing
Ideas are welcome! To compile:
```js
npm run build
```
To test (node v4)
```js
npm run test
```
To test (node v6)
```js
npm run test_v6
```

##Handcrafted at 
[www.labcup.net](http://www.labcup.net/)
