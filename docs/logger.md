## Logging

The logger need to have the following interface:

``` js 
export interface PgDbLogger {
    log: Function;
    error: Function;
}
```

where log most of the time is called with 3 params:
1. sql query
2. parameter array if any
3. connection id (from the pool)

It is possible to specify separate loggers per schemas. Just call
```js
pgdb.setLogger(console); //default
pgdb.schemas['myschema'].setLogger(myLogger); 
```

However queries like: 
```js
pgdb.run('SELECT password FROM myschema.users'); 
```
will be logged by the default logger in this case.


