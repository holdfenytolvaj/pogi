For all the examples below 
```js
import {PgDb} from "pgdb/lib";

let pgdb = PgDb.connect(..);
```

##Properties
### db:PgDb
### schemas:{[name:string]:PgSchema}

##Functions
### setLogger(logger:PgDbLogger) 
Note: inherited.

Sets the fallback logger for all queries (if no schema, table or query level logger is set, this will be used).
```js
pgdb.setLogger(console);
```
### isTransactionActive():Promise&lt;PgDb&gt;
Returns true if the active connection has transaction ongoing. (Does not detect timeouts.)

##Functions - async
### run(sql:string):Promise&lt;Record[]&gt;
Executes an arbitrary sql string;
```js
await schema.run('CREATE schema myschema');
```
### query(sql:string, params?:any[], options?:SqlQueryOptions):Promise&lt;any[]&gt;
### query(sql:string, params?:Object, options?:SqlQueryOptions):Promise&lt;any[]&gt;
<a name="query"></a>

Executes an arbitrary sql string with parameters / named parameters. 
```ts
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

### static connect(config:ConnectionOptions):Promise&lt;PgDb&gt;
see the "connection" section

### reload()
Rerun the queries to load the schemas, tables and special types.
Need to be called after truncate(!), alter table, create schema etc.

### setTypeParser(typeName:string, parser:(string)=&gt;any, schemaName?:string): Promise&lt;void&gt;
see the "mapping database types to js types" section
 
### transactionBegin():Promise&lt;PgDb&gt;
Start a transaction and return with the connection. 
(Only this connection has the transaction, can be committed or rolled back.)

for example see the "transaction" section. 
 
### transactionCommit():Promise&lt;PgDb&gt;
If the connection had transaction it commits it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 

### transactionRollback():Promise&lt;PgDb&gt;
If the connection had transaction it rolls back it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 


### execute(fileName, transformer?:(string)=&gt;string)):Promise&lt;void&gt;
Executes an sql file, with a transformer function. For more details see "Executing sql files" section.

```js
for (let schemaName of ['test1', 'test2']) {
    await pgdb.execute(__dirname + '/db_upgrade/all.sql', (cmd)=&gt;cmd.replace(/__SCHEMA__/g, '"' + schemaName + '"'));
}
```

where the sql file is
```sql
UPDATE __SCHEMA__.webapp set lang='TS' where lang='JS';
```
