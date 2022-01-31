import * as pg from 'pg';
import { PgDbLogger } from "./pgDbLogger";
import { IPgTable } from "./pgTableInterface";
import { IPgSchema } from "./pgSchemaInterface";
import { IQueryAble } from './queryAbleInterface';
import { ConnectionOptions } from './connectionOptions';
export interface ResultFieldType {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
}
export interface Notification {
    processId: number;
    channel: string;
    payload?: string;
}
export declare enum TranzactionIsolationLevel {
    serializable = "SERIALIZABLE",
    repeatableRead = "REPEATABLE READ",
    readCommitted = "READ COMMITTED",
    readUncommitted = "READ UNCOMMITTED"
}
export declare type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;
export interface IPgDb extends IQueryAble {
    connection: pg.PoolClient | null;
    config: ConnectionOptions;
    pool: pg.Pool;
    pgdbTypeParsers: any;
    knownOids: Record<number, boolean>;
    schemas: {
        [name: string]: IPgSchema;
    };
    tables: {
        [name: string]: IPgTable<any>;
    };
    runRestartConnectionForListen(): Promise<Error | null>;
    needToFixConnectionForListen(): boolean;
    postProcessResult: PostProcessResultFunc | undefined | null;
    resetMissingParsers(connection: pg.PoolClient, oidList: number[]): Promise<void>;
    transactionBegin(options?: {
        isolationLevel?: TranzactionIsolationLevel;
        deferrable?: boolean;
        readOnly?: boolean;
    }): Promise<IPgDb>;
    transactionCommit(): Promise<IPgDb>;
    listen(channel: string, callback: (notification: Notification) => void): Promise<void>;
    unlisten(channel: string, callback?: (notification: Notification) => void): Promise<void>;
    notify(channel: string, payload?: string): Promise<any[]>;
}
