import { PgDbLogger } from './pgDbLogger';

export interface ForceEscapeColumnsOptions {
    select?: boolean
    where?: boolean
    orderBy?: boolean
    groupBy?: boolean
    //warningOnly?: boolean
}

/**
 * @property connectionString e.g.: "postgres://user@localhost/database"
 * @property host can be specified through PGHOST env variable
 * @property user can be specified through PGUSER env variable (defaults USER env var)
 * @property database can be specified through PGDATABASE env variable (defaults USER env var)
 * @property password can be specified through PGPASSWORD env variable
 * @property port can be specified through PGPORT env variable
 * @property idleTimeoutMillis how long a client is allowed to remain idle before being closed
 * @property skipUndefined if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
 * @property logSQLDetailsOnError - log sql and params in case of sql error (this might contain sensitive information)
 */
export interface ConnectionOptions {
    /** host can be specified through PGHOST env variable (defaults USER env var) */
    host?: string;
    /** user can be specified through PGUSER env variable (defaults USER env var) */
    user?: string;
    /** can be specified through PGDATABASE env variable (defaults USER env var) */
    database?: string;
    /** can be specified through PGPASSWORD env variable */
    password?: string;
    /** can be specified through PGPORT env variable */
    port?: number;
    poolSize?: number;

    //number of rows to return at a time from a prepared statement's portal. 0 will return all rows at once
    rows?: number;
    /** set min pool size */
    min?: number;
    /** set pool max size */
    max?: number;

    binary?: boolean;
    poolIdleTimeout?: number;
    reapIntervalMillis?: number;
    poolLog?: boolean;
    client_encoding?: string;
    ssl?: boolean | any; //| TlsOptions;
    /** default:process.env.PGAPPNAME - name displayed in the pg_stat_activity view and included in CSV log entries */
    application_name?: string;
    fallback_application_name?: string;
    parseInputDatesAsUTC?: boolean;
    /** e.g.: "postgres://user@localhost/database" */
    connectionString?: string;
    /** how long a client is allowed to remain idle before being closed */
    idleTimeoutMillis?: number;

    logger?: PgDbLogger;
    /** if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined. */
    skipUndefined?: 'all' | 'select' | 'none';

    /**
     * Turn on strict escape columns parameters for select, from, where, group by, order by
     */
    forceEscapeColumns?: boolean | ForceEscapeColumnsOptions;
}
