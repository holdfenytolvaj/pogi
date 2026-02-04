import stream from "stream";
import { PgDb } from './index.js';
import { FieldType } from "./pgDb.js";
import { PgSchema } from "./pgSchema.js";
import { CountOption, InsertOption, Return, Stream, TruncateOptions, UpdateDeleteOption, UpsertOption } from "./pgTableInterface.js";
import { QueryAble } from "./queryAble.js";
import { QueryOptions } from "./queryAbleInterface.js";
export declare class PgTable<T> extends QueryAble {
    schema: PgSchema;
    protected desc: {
        name: string;
        pkey?: string;
        schema: string;
    };
    qualifiedName: string;
    pkey: string;
    db: PgDb;
    fieldTypes: {
        [index: string]: FieldType;
    };
    constructor(schema: PgSchema, desc: {
        name: string;
        pkey?: string;
        schema: string;
    }, fieldTypes?: Record<string, FieldType>);
    toString(): string;
    insert(records: T[], options?: InsertOption): Promise<number>;
    insert(records: T, options?: InsertOption): Promise<number>;
    insertAndGet(records: T[], options?: InsertOption & Return): Promise<T[]>;
    insertAndGet(records: T, options?: InsertOption & Return): Promise<T>;
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
    findWhere(where: string, params: any[] | {}, options?: QueryOptions): Promise<T[]>;
    findWhere(where: string, params: any[] | {}, options?: QueryOptions & Stream): Promise<stream.Readable>;
    findAll(options?: QueryOptions): Promise<T[]>;
    findAll(options?: QueryOptions & Stream): Promise<stream.Readable>;
    findOne(conditions: Record<string, any>, options?: QueryOptions): Promise<T>;
    findFirst(conditions: Record<string, any>, options?: QueryOptions): Promise<T>;
    count(conditions?: Record<string, any>, options?: CountOption): Promise<number>;
    findOneFieldOnly(conditions: Record<string, any>, field: string, options?: QueryOptions): Promise<any>;
    private getInsertQuery;
    protected getUpdateSetSnippet(fields: {
        [k: string]: any;
    }, parameters?: any[]): {
        snippet: string;
        parameters: any[];
    };
    protected getUpdateQuery(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): {
        sql: string;
        parameters: any[];
    };
    protected getUpsertQuery<T extends object>(record: T, options?: UpsertOption): {
        sql: string;
        parameters: any[];
    };
    protected getDeleteQuery(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): {
        sql: string;
        parameters: any[];
    };
}
