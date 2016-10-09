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
