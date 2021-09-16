For all the examples below 
```js
import {PgDb} from "pogi";

let pgdb = PgDb.connect(..);
```
Note: search path will be readed on connection and `tables` and `fn` properties will be populated by that. However these are not merged into PgDb object, while schemas will be.

#Properties
## db
<span class="def">db:</span><span class="type">PgDb</span>
Back reference to this instance.
## schemas
<span class="def">schemas:</span><span class="type">{[name:string]:PgSchema}</span>
Schemas, also merged to db object.
## tables
<span class="def">tables:</span><span class="type">{[name:string]:PgTable}</span>
Tables in the search_path.
## fn
<span class="def">fn:</span><span class="type">{[name:string]:Function}</span>
Stored procedures and functions in the search_path.
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

# Functions - async

## connect
<span style="color:darkorange;">static</span> <span class="def"><span class="func">connect</span>(config:<span class="type">ConnectionOptions</span>):Promise&lt;<span class="type">PgDb</span>&gt;</span>

see [connection](/connection) section

---
## close
<span style="color:darkorange;">static</span> <span class="def"><span class="func">close</span>():Promise&lt;<span class="type">void</span>&gt;</span>

Close connection, useful for exiting/teardown code.

---
## dedicatedConnectionBegin
<span class="def"><span class="func">dedicatedConnectionBegin</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

You can use dedicated connection instead of pool. It is very useful if you plan to use such a command: `SET search_path TO "dev";`
Similar to [transactionBegin](#transactionBegin) but without transaction. This function will create a new PgDb instance with the dedicated connection mode. 
Use of that Pgdb instance all query will go throuth that single connection. The original pgdb instance won't touched.
For example see the [transaction](/transaction) section. 

---
## dedicatedConnectionEnd
<span class="def"><span class="func">dedicatedConnectionEnd</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

Close dedicated connection. If there is no dedicated connection, do nothing. After that pgdb instance will work in pooled connection mode. 
Return value will be the same pgdb instance.
For example see the [transaction](/transaction) section. 

---
## execute
<span class="def"><span class="func">execute</span>(fileName, transformer?:<span class="type">(string)=&gt;string)</span>):Promise&lt;<span class="type">void</span>&gt;</span>

Executes an sql file, with a transformer function. For more details see [Executing sql files](/executingSqlFile) section.

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
##queryFirst
<span class="def"><span class="func">queryFirst</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;</span>
<a name="query"></a>

Executes an arbitrary sql string with parameters / named parameters. Return the first record. 

---
##queryOne
<span class="def"><span class="func">query</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;</span>
<a name="query"></a>
 
Executes an arbitrary sql string with parameters / named parameters. Return the first record, throw Error if there are more. 

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

See the [mapping database types to js types](/mappingDatabaseTypes) section

---
## setPgTypeParser
<span class="def"><span class="func">setPgTypeParser</span>(typeName:<span class="type">string</span>, parser:<span class="type">(string)=&gt;any</span>, schemaName?:<span class="type">string</span>): Promise&lt;<span class="type">void</span>&gt;</span>

See the [mapping database types to js types](/mappingDatabaseTypes) section

---
## setPostProcessResult
<span class="def"><span class="func">setPostProcessResult</span>(f:(res: <span class="type">any[]</span>, fields: <span class="type">ResultFieldType[]</span>, logger:<span class="type">PgDbLogger</span>)=&gt;<span class="type">void</span>): <span class="type">void</span></span>
You can add a postprocessor function that will be executed for every result (even empty ones), if you want to do something extra.
If you call it twice the second function will overwrite the first. So you can easily unset also if you call it will null; 

---
## transactionBegin 
<span class="def"><span class="func">transactionBegin</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

Return with a new PgDb instance with dedicated connection mode and start a transaction. 
(Only this connection has the transaction, can be committed or rolled back. Similar to [dedicatedConnectionBegin](#dedicatedConnectionBegin))

For example see the [transaction](/transaction) section. 

---
## transactionCommit 
<span class="def"><span class="func">transactionCommit</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

If the PgDb instance has dedicated connection mode and has transaction it will commits that, otherwise do nothing.
Returns with PgDb instance (with pool connections mode) where no transaction is taking place.
For example see the [transaction](/transaction) section. 

---
## transactionRollback
<span class="def"><span class="func">transactionRollback</span>():Promise&lt;<span class="type">PgDb</span>&gt;</span>

If the PgDb instance has dedicated connection mode and has transaction it will rolls back, otherwise do nothing.
Returns with PgDb instance (with pool connections mode) where no transaction is taking place.
For example see the [transaction](/transaction) section. 

---
## listen
<span class="def"><span class="func">listen</span>(channel:<span class="type">string</span>, callback:<span class="type">(Notification)=&gt;void)</span>;</>

Creates a new dedicated connection for listeners (if it not exists), and sets a callback for the channel.
It is possible to set multiple callbacks for one channel.
If there will be a notification from the database, the callback will run.
For example see the [notification](/notification) section.

---
## unlisten
<span class="def"><span class="func">unlisten</span>(channel:<span class="type">string</span>, callback?:<span class="type">(Notification)=&gt;void)</span>;</>

Removes a listener. If callback parameter is set, only the given callback will be removed.
If callback parameter is not set, all callbacks will be removed from the channel.
If it was the last channel, the dedicated connection for listeners will be released.
For example see the [notification](/notification) section.

---
## notify
<span class="def"><span class="func">notify</span>(channel:<span class="type">string</span>, payload?:<span class="type">string</span>;</>

Send a notification via postgresql.
For example see the [notification](/notification) section.
