import {PgDbLogger} from './pgDbLogger';
import * as pg from 'pg';

export interface ConnectionOptions extends pg.ConnectionConfig{
    /** host can be specified through PGHOST env variable */
    host?: string;
    /** user can be specified through PGUSER env variable (defaults USER env var) */
    user?: string; 
    /** can be specified through PGDATABASE env variable */
    database?: string;
    /** can be specified through PGPASSWORD env variable */
    password?: string;
    /** can be specified through PGPORT env variable */
    port?: number;
    poolSize?: number;

    /** number of rows to return at a time from a prepared statement's portal. 0 will return all rows at once */
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
}
