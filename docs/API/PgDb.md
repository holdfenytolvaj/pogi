For all the examples below 
```js
import {PgDb} from "pgdb/lib";

let pgdb = PgDb.connect(..);
```

##Properties
### <span class="def">db:</span><span class="type">PgDb</span>
### <span class="def">schemas:</span><span class="type">{[name:string]:PgSchema}</span>

##Functions
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
```js
await schema.run('CREATE schema myschema');
```
### <span class="def"><span class="func">query</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;
<a name="query"></a>

Executes an arbitrary sql string with parameters / named parameters. 
```ts
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
see [streams](../../streams) section 


### <span style="color:darkorange;">static</span> <span class="def"><span class="func">connect</span>(config:<span class="type">ConnectionOptions</span>):Promise&lt;<span class="type">PgDb</span>&gt;
see [connection](../../connection) section

### <span class="def"><span class="func">reload()
Rerun the queries to load the schemas, tables and special types.
Need to be called after truncate(!), alter table, create schema etc.

### <span class="def"><span class="func">setTypeParser</span>(typeName:<span class="type">string</span>, parser:<span class="type">(string)=&gt;any</span>, schemaName?:<span class="type">string</span>): Promise&lt;<span class="type">void</span>&gt;
see the [mapping database types to js types](../../mappingDatabaseTypes) section
 
### <span class="def"><span class="func">setPgTypeParser</span>(typeName:<span class="type">string</span>, parser:<span class="type">(string)=&gt;any</span>, schemaName?:<span class="type">string</span>): Promise&lt;<span class="type">void</span>&gt;
see the [mapping database types to js types](../../mappingDatabaseTypes) section

### <span class="def"><span class="func">ransactionBegin</span>():Promise&lt;<span class="type">PgDb</span>&gt;
Start a transaction and return with the connection. 
(Only this connection has the transaction, can be committed or rolled back.)

for example see the [transaction](../../transaction) section. 
 
### <span class="def"><span class="func">transactionCommit</span>():Promise&lt;<span class="type">PgDb</span>&gt;
If the connection had transaction it commits it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 

### <span class="def"><span class="func">transactionRollback</span>():Promise&lt;<span class="type">PgDb</span>&gt;
If the connection had transaction it rolls back it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 


### <span class="def"><span class="func">execute</span>(fileName, transformer?:<span class="type">(string)=&gt;string)</span>):Promise&lt;<span class="type">void</span>&gt;
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
