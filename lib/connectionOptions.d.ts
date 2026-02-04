import { PgDbLogger } from './pgDbLogger.js';
export interface ForceEscapeColumnsOptions {
    select?: boolean;
    where?: boolean;
    orderBy?: boolean;
    groupBy?: boolean;
}
export interface ConnectionOptions {
    host?: string;
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    poolSize?: number;
    rows?: number;
    min?: number;
    max?: number;
    binary?: boolean;
    poolIdleTimeout?: number;
    reapIntervalMillis?: number;
    poolLog?: boolean;
    client_encoding?: string;
    ssl?: boolean | any;
    application_name?: string;
    fallback_application_name?: string;
    parseInputDatesAsUTC?: boolean;
    connectionString?: string;
    idleTimeoutMillis?: number;
    logger?: PgDbLogger;
    skipUndefined?: 'all' | 'select' | 'none';
    forceEscapeColumns?: boolean | ForceEscapeColumnsOptions;
}
