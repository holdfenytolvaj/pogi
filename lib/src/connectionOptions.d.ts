import { PgDbLogger } from './pgDbLogger';
export interface ConnectionOptions {
    host?: string;
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    poolSize?: number;
    forceEscapeColumns?: boolean | {
        select?: boolean;
        where?: boolean;
        orderBy?: boolean;
        groupBy?: boolean;
    };
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
    strictDdl?: boolean;
    strictDdlSelect?: boolean;
    strictDdlWhere?: boolean;
}
