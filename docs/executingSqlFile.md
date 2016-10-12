## Executing sql files

### Run an sql file for a single schema

```js

    let pgdb = await PgDb.connect(..);
    await pgdb.execute(__dirname + '/init.sql');
    
```


### Run an sql file for multiple schemas:

```js
imports ..

let pgdb = await PgDb.connect(..);
try {
    for (let schemaName of ['test1', 'test2']) {
        await pgdb.execute(__dirname + '/db_upgrade/all.sql', 
                           (cmd)=>cmd.replace(/__SCHEMA__/g, '"' + schemaName + '"'));
    }
} catch (e) {
    //log
}
```

for example the sql file is (note: `__SCHEMA__` will be replaced with the `schemaName` see above)
```sql

DO $$
    BEGIN
        BEGIN
            ALTER TABLE __SCHEMA__.webapp add column lang char(2) default 'JS';
        EXCEPTION
            WHEN duplicate_column THEN RAISE NOTICE 'column <column_name> already exists in <table_name>.';
        END;
    END;
$$;

UPDATE __SCHEMA__.webapp set lang='TS' where lang='JS';

```
