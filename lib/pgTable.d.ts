import { QueryAble, QueryOptions } from "./queryAble";
import { PgDb, FieldType, PgDbLogger } from "./pgDb";
import { PgSchema } from "./pgSchema";
export interface InsertOption {
    'return'?: string[] | true;
    logger?: PgDbLogger;
}
export interface InsertOption2 {
    'return': false;
    logger?: PgDbLogger;
}
export interface UpdateDeleteOption {
    return?: string[];
    logger?: PgDbLogger;
}
export interface UpdateDeleteOptionDefault {
    logger?: PgDbLogger;
}
export declare class PgTable extends QueryAble {
    schema: PgSchema;
    protected desc: {
        name: string;
        pk: string;
        schema: string;
    };
    qualifiedName: string;
    db: PgDb;
    fieldTypes: {
        [index: string]: FieldType;
    };
    constructor(schema: PgSchema, desc: {
        name: string;
        pk: string;
        schema: string;
    }, fieldTypes?: {});
    toString(): string;
    /**
     * If you dont want to use the result set the options.return to false
     * by default it is true. Also can set it to the fields that need to be returned,
     * e.g.:
     *
     * let res = await table.insert([{username:'anonymous'},{username:'anonymous2'}], {return:['id']})
     * res; // [{id:1},{id:2}]
     *
     * let res = await table.insert({username:'anonymous'}, {return:false})
     * res; // void
     *
     * let res = await table.insert({username:'anonymous'})
     * res; // {id:1, name:'anonymous', created:'...'}
     *
     */
    insert<T>(records: T, options?: InsertOption): Promise<T>;
    insert<T>(records: T, options?: InsertOption2): Promise<void>;
    insert<T>(records: T[], options?: InsertOption): Promise<T[]>;
    insert<T>(records: T[], options?: InsertOption2): Promise<void>;
    updateOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOptionDefault): Promise<number>;
    updateAndGetOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<any>;
    update(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOptionDefault): Promise<number>;
    updateAndGet(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<any[]>;
    delete(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOptionDefault): Promise<number>;
    deleteOne(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOptionDefault): Promise<number>;
    deleteAndGet(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<any[]>;
    deleteAndGetOne(conditions: {
        [k: string]: any;
    }, options?: UpdateDeleteOption): Promise<any>;
    deleteAll(options?: UpdateDeleteOptionDefault): Promise<number>;
    find(conditions: {
        [k: string]: any;
    }, options?: QueryOptions): Promise<any[]>;
    findWhere(where: string, params: any[], options?: QueryOptions): Promise<any[]>;
    findWhere(where: string, params: Object, options?: QueryOptions): Promise<any[]>;
    findAll(options?: QueryOptions): Promise<any[]>;
    findOne(conditions: any, options?: QueryOptions): Promise<any>;
    findFirst(conditions: any, options?: QueryOptions): Promise<any>;
    count(conditions?: any): Promise<number>;
    findOneFieldOnly(conditions: any, field: string, options?: QueryOptions): Promise<any>;
    protected getUpdateQuery(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }): {
        sql: string;
        parameters: any[];
    };
    protected getDeleteQuery(conditions: {
        [k: string]: any;
    }): {
        sql: string;
        parameters: any[];
    };
}
