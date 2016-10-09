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

It is possible to specify separate loggers per schemas (and tables or queries). E.g.
```js
let myDbLogger = console;
let mySchemaLogger = {log:()=>{}, error:console.error};
let myTableLogger = {log:(sql, params, connectionId) => (connectionId) ? console.log('[',connectionId,']', sql,' < ',params) : console.log(sql), 
                     error:console.error};
let myQueryLogger = console;
                     
pgdb.setLogger(myDbLogger); //default console
pgdb.myschema.setLogger(mySchemaLogger);
pgdb.myschema.users.setLogger(myTableLogger); 

pgdb.run('SELECT password FROM myschema.users');  //logged by myDbLogger
pgdb.myschema.run('SELECT password FROM myschema.users'); //logged by mySchemaLogger
pgdb.myschema.machines.findAll(); //logged by mySchemaLogger

pgdb.myschema.users.findAll(); //logged by myTableLogger

pgdb.myschema.users.findAll({logger:myQueryLogger}); //logged by myQueryLogger
```
The first logger found will be the one to be used.



