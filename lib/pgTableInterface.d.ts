/// <reference types="node" />
import { IQueryAble, QueryOptions } from "./queryAbleInterface";
import { FieldType } from "./pgDb";
import { IPgDb } from "./pgDbInterface";
import { PgDbLogger } from "./pgDbLogger";
import * as stream from "stream";
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
export interface IPgTable<T> extends IQueryAble {
    qualifiedName: string;
    pkey: string;
    db: IPgDb;
    fieldTypes: {
        [index: string]: FieldType;
    };
    toString: () => String;
    insert(records: T[], options?: InsertOption): Promise<number>;
    insert(records: T, options?: InsertOption): Promise<number>;
    insert(records: any, options?: any): Promise<any>;
    insertAndGet(records: T[], options?: InsertOption & Return): Promise<T[]>;
    insertAndGet(records: T, options?: InsertOption & Return): Promise<T>;
    insertAndGet(records: any, options?: InsertOption & Return): Promise<any>;
    updateOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<number>;
    updateAndGetOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption & Return): Promise<T>;
    update(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<number>;
    updateAndGet(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption & Return): Promise<T[]>;
    upsert(record: T, options?: UpsertOption): Promise<number>;
    upsertAndGet(record: T, options?: UpsertOption & Return): Promise<T>;
    delete(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<number>;
    deleteOne(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<number>;
    deleteAndGet(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption & Return): Promise<any[]>;
    deleteAndGetOne(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption & Return): Promise<any>;
    truncate(options?: TruncateOptions): Promise<void>;
    find(conditions: {
        [k: string]: any;
    }, options?: QueryOptions): Promise<T[]>;
    find(conditions: {
        [k: string]: any;
    }, options?: QueryOptions & Stream): Promise<stream.Readable>;
    find(conditions: {
        [k: string]: any;
    }, options?: any): Promise<any>;
    findWhere(where: string, params: any[] | {}, options?: QueryOptions): Promise<T[]>;
    findWhere(where: string, params: any[] | {}, options?: QueryOptions & Stream): Promise<stream.Readable>;
    findWhere(where: string, params: any, options?: any): Promise<any>;
    findAll(options?: QueryOptions): Promise<T[]>;
    findAll(options?: QueryOptions & Stream): Promise<stream.Readable>;
    findAll(options?: any): Promise<any>;
    findOne(conditions: Record<string, any>, options?: QueryOptions): Promise<T>;
    findFirst(conditions: Record<string, any>, options?: QueryOptions): Promise<T>;
    count(conditions?: {}, options?: CountOption): Promise<number>;
    findOneFieldOnly(conditions: Record<string, any>, field: string, options?: QueryOptions): Promise<any>;
}
