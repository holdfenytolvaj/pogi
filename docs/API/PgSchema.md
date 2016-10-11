For all the examples below 
```js
import {PgDb, PgSchema} from "pgdb/lib/index";

let pgdb:PgDb     = PgDb.connect(..);
let schema:PgSchema = pgdb.schemas['test1'];  
```
##Properties
### <span class="def">db:</span><span class="type">PgDb</span>
### <span class="def">tables:</span><span class="type">{[name:string]:PgTable}</span>

##Functions
###<span class="def"><span class="func">toString</span>()</span>
returns the name of the schema

###<span class="def"><span class="func">setLogger</span>(logger:<span class="type">PgDbLogger</span>) </span>
Note: inherited.

Sets the fallback logger for all queries (if no schema, table or query level logger is set, this will be used).
```js
pgdb.setLogger(console);
```
### <span class="def"><span class="func">isTransactionActive</span>():Promise&lt;<span class="type">PgDb</span>&gt;
Returns true if the active connection has transaction ongoing. (Does not detect timeouts.)


##Functions - async
### <span class="def"><span class="func">run</span>(sql:<span class="type">string</span>):Promise&lt;<span class="type">any[]</span>&gt;
Executes an arbitrary sql string.
Note: inherited, uses schema level log if present (if not then the db level log).

Executes an arbitrary sql string;
```js
await schema.run('CREATE schema myschema');
```

### <span class="def"><span class="func">query</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;
<a name="query"></a>
Note: inherited, uses schema level log if present (if not then the db level log).

Executes an arbitrary sql string with parameters / named parameters;
```js
let res1 = await schema.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await schema.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});
```

### <span class="def"><span class="func">queryOneField</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js
let winner = await schema.getOneField(`SELECT 'The winner is ' || name FROM test1.users LIMIT 1`);
console.log(winner); //The winner is Admin
```

### <span class="def"><span class="func">queryOneColumn</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type"><span class="type">any[]</span>&gt;
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js
let userList = await schema.getOneColumn('SELECT name FROM test1.users');
console.dir(userList); //['Admin', 'User1', 'User2']
```

### <span class="def"><span class="func">queryAsStream</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;
see [streams](../../streams)

