For all the examples below 
```js
import {PgDb, PgSchema} from "pgdb/lib/index";

let pgdb:PgDb     = PgDb.connect(..);
let schema:PgSchema = pgdb.schemas['test1'];  
```
##Properties
### db:PgDb
### tables:{[name:string]:PgTable}

##Functions
### toString()
returns the name of the schema

### setLogger(logger:PgDbLogger) 
Note: inherited.

Sets the logger per schema (Note:not used for tables and queries with their own loggers specified).
```js
schema.setLogger(console);
```

##Functions - async
### run(sql:string):Promise&lt;Record[]&gt;
Note: inherited, uses schema level log if present (if not then the db level log).

Executes an arbitrary sql string;
```js
await schema.run('CREATE schema myschema');
```

### query(sql:string, params?:any[], options?:SqlQueryOptions):Promise&lt;any[]&gt;
### query(sql:string, params?:Object, options?:SqlQueryOptions):Promise&lt;any[]&gt;
<a name="query"></a>
Note: inherited, uses schema level log if present (if not then the db level log).

Executes an arbitrary sql string with parameters / named parameters;
```js
let res1 = await schema.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await schema.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});
```

### queryOneField(sql:string, params?:any[], options?:SqlQueryOptions):Promise&lt;any&gt;
### queryOneField(sql:string, params?:Object, options?:SqlQueryOptions):Promise&lt;any&gt;
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js
let winner = await schema.getOneField(`SELECT 'The winner is ' || name FROM test1.users LIMIT 1`);
console.log(winner); //The winner is Admin
```

### queryOneColumn(sql:string, params?:any[], options?:SqlQueryOptions):Promise&lt;any[]&gt;
### queryOneColumn(sql:string, params?:Object, options?:SqlQueryOptions):Promise&lt;any[]&gt;
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js
let userList = await schema.getOneColumn('SELECT name FROM test1.users');
console.dir(userList); //['Admin', 'User1', 'User2']
```

### queryAsStream(sql:string, params?:any[], options?:SqlQueryOptions):Promise&lt;any[]&gt;
### queryAsStream(sql:string, params?:Object, options?:SqlQueryOptions):Promise&lt;any[]&gt;
see [streams](../../streams)

