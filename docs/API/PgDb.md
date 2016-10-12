For all the examples below 
```js
import {PgDb} from "pgdb/lib";

let pgdb = PgDb.connect(..);
```
Note: search path will be readed on connection and `tables` and `fn` properties will be populated by that. However these are not merged to pgdb while schemas will be.

#Properties
## <span class="def">db:</span><span class="type">PgDb</span>
## <span class="def">schemas:</span><span class="type">{[name:string]:PgSchema}</span>
## <span class="def">tables:</span><span class="type">{[name:string]:PgTable}</span>
## <span class="def">fn:</span><span class="type">{[name:string]:Function}</span>

#Functions
##setLogger
<span class="def"><span class="func">setLogger</span>(logger:<span class="type">PgDbLogger</span>) </span>

Note: inherited.

Sets the fallback logger for all queries (if no schema, table or query level logger is set, this will be used).
```js
pgdb.setLogger(console);
```

---
## isTransactionActive
<span class="def"><span class="func">isTransactionActive</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

Returns true if the active connection has transaction ongoing. (Does not detect timeouts.)

#Functions - async
## connect
<span style="color:darkorange;">static</span> <span class="def"><span class="func">connect</span>(config:<span class="type">ConnectionOptions</span>):Promise&lt;<span class="type">PgDb</span>&gt;</span>

see [connection](/connection) section


---
## dedicatedConnectionBegin
<span class="def"><span class="func">dedicatedConnectionBegin</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

---
## dedicatedConnectionEnd
<span class="def"><span class="func">dedicatedConnectionEnd</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

---
## execute
<span class="def"><span class="func">execute</span>(fileName, transformer?:<span class="type">(string)=&gt;string)</span>):Promise&lt;<span class="type">void</span>&gt;</span>

Executes an sql file, with a transformer function. For more details see "Executing sql files" section.

```js
for (let schemaName of ['test1', 'test2']) {
    await pgdb.execute(__dirname + '/db_upgrade/all.sql', (cmd)=&gt;cmd.replace(/__SCHEMA__/g, '"' + schemaName + '"'));
}
```

where the sql file is (`__SCHEMA__` will be replaced to the `schemaName` see above)
```sql
UPDATE __SCHEMA__.webapp set lang='TS' where lang='JS';
```

---
##query
<span class="def"><span class="func">query</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>
<a name="query"></a>

Executes an arbitrary sql string with parameters / named parameters. 
```ts
let res1 = await schema.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await schema.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});
```

---
## queryOneField
<span class="def"><span class="func">queryOneField</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;</span>

Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js
let winner = await schema.getOneField(`SELECT 'The winner is ' || name FROM test1.users LIMIT 1`);
console.log(winner); //The winner is Admin
```

---
## queryOneColumn
<span class="def"><span class="func">queryOneColumn</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js
let userList = await schema.getOneColumn('SELECT name FROM test1.users');
console.dir(userList); //['Admin', 'User1', 'User2']
```

---
## queryAsStream
<span class="def"><span class="func">queryAsStream</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

---
## reload
<span class="def"><span class="func">reload</span>()</span>
Rerun the queries to load the schemas, tables and special types.
Need to be called after truncate(!), alter table, create schema etc.

---
##run
<span class="def"><span class="func">run</span>(sql:<span class="type">string</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>
Executes an arbitrary sql string.
```js
await schema.run('CREATE schema myschema');
```

---
## setTypeParser
<span class="def"><span class="func">setTypeParser</span>(typeName:<span class="type">string</span>, parser:<span class="type">(string)=&gt;any</span>, schemaName?:<span class="type">string</span>): Promise&lt;<span class="type">void</span>&gt;</span>

see the [mapping database types to js types](/mappingDatabaseTypes) section

---
## setPgTypeParser
<span class="def"><span class="func">setPgTypeParser</span>(typeName:<span class="type">string</span>, parser:<span class="type">(string)=&gt;any</span>, schemaName?:<span class="type">string</span>): Promise&lt;<span class="type">void</span>&gt;</span>

see the [mapping database types to js types](/mappingDatabaseTypes) section


---
## transactionBegin 
<span class="def"><span class="func">transactionBegin</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

Start a transaction and return with the connection. 
(Only this connection has the transaction, can be committed or rolled back.)

for example see the [transaction](/transaction) section. 

---
## transactionCommit 
<span class="def"><span class="func">transactionCommit</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

If the connection had transaction it commits it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 

---
## transactionRollback
<span class="def"><span class="func">transactionRollback</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

If the connection had transaction it rolls back it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 
