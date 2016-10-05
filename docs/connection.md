#Connection

## Connection with connectionString

``` js
let pgdb = await PgDb.connect({connectionString:'postgres://username@hostname/database', logger:console});
```

where username/hostname/database are all optional see below, if provided through the environment variables.

## Connection with Options Object
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
}
```

## Static singleton
If there is no reference kept to the object there is a static function to get the same object everywhere, 
(so no need to keep reconnecting). Not necessarily recommended.

``` js
    let pgdb = await PgDb.getInstance({connectionString:'postgres://username@hostname/database', logger:console});
```
