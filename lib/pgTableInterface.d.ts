import { PgDbLogger } from "./pgDbLogger.js";
export interface InsertOption {
    logger?: PgDbLogger;
}
export interface Return {
    return?: string[] | '*';
}
export interface UpdateDeleteOption {
    skipUndefined?: boolean;
    logger?: PgDbLogger;
}
export interface UpsertOption {
    constraint?: string;
    columns?: string[];
    logger?: PgDbLogger;
}
export interface CountOption {
    skipUndefined?: boolean;
    logger?: PgDbLogger;
}
export interface Stream {
    stream: true;
}
export interface TruncateOptions {
    restartIdentity?: boolean;
    cascade?: boolean;
    logger?: PgDbLogger;
}
