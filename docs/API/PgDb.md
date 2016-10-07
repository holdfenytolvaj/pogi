For all the examples below 
```js
import {PgDb} from "pgdb/lib/index";

let pgdb = PgDb.connect(..);
```

## setLogger(logger:PgDbLogger) 
Note: inherited.

Sets the fallback logger for all queries (if no schema, table or query level logger is set, this will be used).
```js
pgdb.setLogger(console);
```

## async run(sql:string):Promise<Record[]>
Executes an arbitrary sql string;
```js
await schema.run('CREATE schema myschema');
```

## async query(sql:string, params?:any[]):Promise<Record[]>
## async query(sql:string, params?:Object):Promise<Record[]>
<a name="query"></a>

Executes an arbitrary sql string with parameters / named parameters;
```js
let res1 = await schema.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await schema.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});
```

## async getOneField(sql:string, params?:any[]):Promise<any>
## async getOneField(sql:string, params?:Object):Promise<any>
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js
let winner = await schema.getOneField(`SELECT 'The winner is ' || name FROM test1.users LIMIT 1`);
console.log(winner); //The winner is Admin
```

## async getOneColumn(sql:string, params?:any[]):Promise<any[]>
## async getOneColumn(sql:string, params?:Object):Promise<any[]>
Note: inherited, uses schema level log if present (if not then the db level log).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js
let userList = await schema.getOneColumn('SELECT name FROM test1.users');
console.dir(userList); //['Admin', 'User1', 'User2']
```

## static async connect(config:ConnectionOptions):Promise<PgDb>
see the "connection" section

## async reload()
Rerun the queries to load the schemas, tables and special types.
Need to be called after truncate(!), alter table, create schema etc.

## async setTypeParser(typeName:string, parser:(string)=>any, schemaName?:string): Promise<void>
see the "mapping database types to js types" section
 
## async transactionBegin():Promise<PgDb>
Start a transaction and return with the connection. 
(Only this connection has the transaction, can be committed or rolled back.)

for example see the "transaction" section. 
 
## async transactionCommit():Promise<PgDb>
If the connection had transaction it commits it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 

## async transactionRollback():Promise<PgDb>
If the connection had transaction it rolls back it, otherwise do nothing.
Returns with PgDb instance (pool of connections) where no transaction is taking place.
for example see the "transaction" section. 

## isTransactionActive():Promise<PgDb>
Returns true if the active connection has transaction ongoing. (Does not detect timeouts.)

## async execute(fileName, transformer?:(string)=>string)):Promise<void>
Executes an sql file, with a transformer function. For more details see "Executing sql files" section.

```js
for (let schemaName of ['test1', 'test2']) {
    await pgdb.execute(__dirname + '/db_upgrade/all.sql', (cmd)=>cmd.replace(/__SCHEMA__/g, '"' + schemaName + '"'));
}
```

where the sql file is
```sql
UPDATE __SCHEMA__.webapp set lang='TS' where lang='JS';
```
