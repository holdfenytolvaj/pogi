import { PgDbLogger } from "./pgDbLogger";
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
export declare enum TransactionIsolationLevel {
    serializable = "SERIALIZABLE",
    repeatableRead = "REPEATABLE READ",
    readCommitted = "READ COMMITTED",
    readUncommitted = "READ UNCOMMITTED"
}
export declare type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;
