import {PgDbLogger} from './pgDbLogger';

/**
 * @property connectionString e.g.: "postgres://user@localhost/database"
 * @property user can be specified through PGHOST env variable
 * @property user can be specified through PGUSER env variable (defaults USER env var)
 * @property database can be specified through PGDATABASE env variable (defaults USER env var)
 * @property password can be specified through PGPASSWORD env variable
 * @property port can be specified through PGPORT env variable
 * @property idleTimeoutMillis how long a client is allowed to remain idle before being closed
 * @property skipUndefined if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
 * @property logSQLDetailsOnError - log sql and params in case of sql error (this might contain sensitive information)
 */
export interface ConnectionOptions {
    host?: string; //host can be specified through PGHOST env variable (defaults USER env var)
    user?: string; //user can be specified through PGUSER env variable (defaults USER env var)
    database?: string; // can be specified through PGDATABASE env variable (defaults USER env var)
    password?: string; // can be specified through PGPASSWORD env variable
    port?: number; // can be specified through PGPORT env variable
    poolSize?: number;

    //number of rows to return at a time from a prepared statement's portal. 0 will return all rows at once
    rows?: number;

    min?: number; //set min pool size
    max?: number; //set pool max size

    binary?: boolean;
    poolIdleTimeout?: number;
    reapIntervalMillis?: number;
    poolLog?: boolean;
    client_encoding?: string;
    ssl?: boolean | any; //| TlsOptions;
    application_name?: string; //default:process.env.PGAPPNAME - name displayed in the pg_stat_activity view and included in CSV log entries
    fallback_application_name?: string;
    parseInputDatesAsUTC?: boolean;
    connectionString?: string;
    idleTimeoutMillis?: number; // how long a client is allowed to remain idle before being closed

    logger?: PgDbLogger;
    skipUndefined?: 'all' | 'select' | 'none'; // if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
}
