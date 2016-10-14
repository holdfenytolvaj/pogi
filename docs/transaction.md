## Transaction
as simple as:
```js
    let pgdb_nt; //no   transaction (using the pool)
    let pgdb_wt; //with transaction

    pgdb_nt = await PgDb.connect(..);
    pgdb_wt = await pgdb_nt.transactionBegin();
    try {
        //look busy
        
        await pgdb_nt.query(..) //executed outside of the transaction
        await pgdb_wt.query(..) //executed inside of the transaction
        
        await pgdb_wt.transactionCommit();
    } catch(e) {
        await pgdb_wt.transactionRollback();
    }
```

active transaction can be tested with
```js
    if (pgdb.isTransactionActive()) {
        //...
    }
```

##Dedicated connection
PgDb use connection pool, so it run every query in a random connection from the pool. Connection pool size can be set at connection time with "poolSize" attribute, see [connection](/connection).
Sometimes single connection mode is desired (ex: execute an SQL file), or if you want to use variables, or set the `search_path`.
It is posibble and its usage very similar to transactions. `dedicatedConnectionBegin()` will create a new PgDb instance which is now in a dedicated connection mode.
All further query will be run in the same connection, no pool is used. Programmer responsibe to close dedicated connection with `dedicatedConnectionEnd()` to avoid leaking. 
If closed, connection will get back to the pool and pgdb instance will work in pool mode.

```js
pgdb = await PgDb.connect(..);
pgdb_1con = await pgdb.dedicatedConnectionBegin();
try {
    //do magic
    await pgdb_1con.query(..);
    await pgdb_1con.schema.table.find(..);
    
} finally {
    //lets release it
    await pgdb_1con.dedicatedConnectionEnd();
}
```
