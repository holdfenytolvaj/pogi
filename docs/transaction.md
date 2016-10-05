## Transaction
as simple as:
```js
    let pgdb_nt; //no   transaction
    let pgdb_wt; //with transaction

    pgdb_nt = await PgDb.connect(..);
    pgdb_wt = await pgdb_nt.transactionBegin();
    ...
    if (Math.random()>=0.5) {
        pgdb_nt = await pgdb_wt.transactionCommit();
    } else {
        pgdb_nt = await pgdb_wt.transactionRollback();
    }
```

active transaction can be tested with
```js
    if (pgdb.isTransactionActive()) {
        //...
    }
```
