import { PgDbLogger } from "./pgDbLogger.js";

export interface ResultFieldType {
    name: string,
    tableID: number,
    columnID: number,
    dataTypeID: number,
    dataTypeSize: number,
    dataTypeModifier: number,
    format: string
}

/** LISTEN callback parameter */
export interface Notification {
    processId: number,
    channel: string,
    payload?: string
}

export enum TransactionIsolationLevel {
    serializable = 'SERIALIZABLE',
    repeatableRead = 'REPEATABLE READ',
    readCommitted = 'READ COMMITTED',
    readUncommitted = 'READ UNCOMMITTED'
}

export type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;

// export interface IPgDb extends IQueryAble {
//     connection: pg.PoolClient | null;
//     config: ConnectionOptions;
//     pool: pg.Pool;
//     pgdbTypeParsers: any;
//     knownOids: Record<number, boolean>
//     schemas: { [name: string]: IPgSchema };
//     tables: { [name: string]: IPgTable<any> };

//     runRestartConnectionForListen(): Promise<Error | null>;
//     needToFixConnectionForListen(): boolean;
//     postProcessResult: PostProcessResultFunc | undefined | null;
//     resetMissingParsers(connection: pg.PoolClient, oidList: number[]): Promise<void>

//     transactionBegin(options?: { isolationLevel?: TransactionIsolationLevel, deferrable?: boolean, readOnly?: boolean }): Promise<IPgDb>
//     transactionCommit(): Promise<IPgDb>;

//     listen(channel: string, callback: (notification: Notification) => void): Promise<void>
//     unlisten(channel: string, callback?: (notification: Notification) => void): Promise<void>
//     /**
//      * Notify a channel (https://www.postgresql.org/docs/current/sql-notify.html)
//      */
//     notify(channel: string, payload?: string): Promise<any[]>
// }