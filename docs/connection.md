##Connection

### Connection with connectionString

``` js
let pgdb = await PgDb.connect({connectionString:'postgres://username@hostname/database', logger:console});
```

where username/hostname/database are all optional. It could be provided through environment variables (EXPORT).

### Connection with Options Object
``` js
let pgdb = await PgDb.connect({
        host: 'localhost',
        user: 'localuser',
        database: 'localdatabase',
        password: 'localpassword', 
        port: 5432, 
        max: 10,
        logger:console,
    });
```

With the following options:
``` js
export interface ConnectionOptions {
    host?:string;
    user?:string;     //can be specified through PGUSER     env variable (defaults USER env var)
    database?:string; //can be specified through PGDATABASE env variable (defaults USER env var)
    password?:string; //can be specified through PGPASSWORD env variable
    port?:number;     //can be specified through PGPORT     env variable
    poolSize?:number;
    rows?:number;
    binary?:boolean;
    reapIntervalMillis?:number;
    poolLog?:boolean;
    client_encoding?:string;
    ssl?:boolean| any; // TlsOptions;
    application_name?:string;
    fallback_application_name?:string;
    parseInputDatesAsUTC?:boolean; 
    connectionString?:string;      //'postgres://username:password@hostname/database'
    idleTimeoutMillis?:number;     // how long a client is allowed to remain idle before being closed
    poolIdleTimeout?:number;

    logger?:PgDbLogger;
    skipUndefined?: 'all' | 'select' | 'none'; //if there is a undefined value in the query condition, what should pogi do. Default is 'none', meaning raise an error if a value is undefined.
}
```
##skipUndefined
while most settings are self explanatory, this parameter is important. In the first version of pogi
we ignored the condition if the value was undefined in order for ease the use e.g.:
``` ts
    let query = {
        powerfull: params.powerfull,
        wise: params.wise
    }
    await pgdb.users.find(query);
```
would return a result if e.g. the `form.wise` would be undefined. While this is comfortable
in many situation, it can cause critical issues e.g. for update
``` ts
   await pgdb.users.update({id:user.id}, {password});
```
would update all users password, in case of the id is undefined. (Although this can be mitigated
with the `updateOne` function as well.) Still the best if no undefined value is allowed in the conditions.
Nevertheless to keep the compatibility, this parameter added, and skipUndefined can be set to `all` if needed.
`select` would allow undefined values for selects/count only but would be strict for update/deletes.
`none` is the new default value, meaning undefined value considered as programming error and will throw an exception.
This setting can be specified on query level as well.


### Static singleton
If there is no reference kept to the object there is a static function to get the same object everywhere, 
(so no need to keep recreating and set up every time). At the moment doesnt handle env variables beside password.

``` js
    let pgdb = await PgDb.getInstance({connectionString:'postgres://username@hostname/database', logger:console});
```
