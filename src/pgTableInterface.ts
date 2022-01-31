import { IQueryAble, QueryOptions } from "./queryAbleInterface";
import { PgDb, FieldType } from "./pgDb";
import { IPgDb } from "./pgDbInterface";
import { IPgSchema } from "./pgSchemaInterface";
import { PgDbLogger } from "./pgDbLogger"
import * as _ from 'lodash';
import * as stream from "stream";

const util = require('util');

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
    constraint?: string,
    columns?: string[],
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
    restartIdentity?: boolean,
    cascade?: boolean,
    logger?: PgDbLogger;
}

export interface IPgTable<T> extends IQueryAble {
    qualifiedName: string;
    pkey: string;
    db: IPgDb;
    fieldTypes: { [index: string]: FieldType }; //written directly

    toString: () => String

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
    insert(records: T[], options?: InsertOption): Promise<number>
    insert(records: T, options?: InsertOption): Promise<number>
    insert(records: any, options?: any): Promise<any> 

    insertAndGet(records: T[], options?: InsertOption & Return): Promise<T[]>
    insertAndGet(records: T, options?: InsertOption & Return): Promise<T>
    insertAndGet(records: any, options?: InsertOption & Return): Promise<any> 

    updateOne(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> 

    updateAndGetOne(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<T> 

    update(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> 

    updateAndGet(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<T[]> 

    /**
     * columnsOrConstraintName is by default the primary key
     */
    upsert(record: T, options?: UpsertOption): Promise<number> 

    /**
     * columnsOrConstraintName is by default the primary key
     */
    upsertAndGet(record: T, options?: UpsertOption & Return): Promise<T> 

    delete(conditions: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> 

    deleteOne(conditions: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> 

    deleteAndGet(conditions: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<any[]> 

    deleteAndGetOne(conditions: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<any> 

    // async deleteAll(options?:UpdateDeleteOption):Promise<number> {
    //     let sql = util.format("DELETE FROM %s ", this.qualifiedName);
    //     sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
    //     let res = await this.query(sql, {logger:options.logger});
    //     return res[0].sum;
    // }

    truncate(options?: TruncateOptions): Promise<void> 

    find(conditions: { [k: string]: any }, options?: QueryOptions): Promise<T[]>
    find(conditions: { [k: string]: any }, options?: QueryOptions & Stream): Promise<stream.Readable>
    find(conditions: { [k: string]: any }, options?: any): Promise<any> 

    findWhere(where: string, params: any[] | {}, options?: QueryOptions): Promise<T[]>
    findWhere(where: string, params: any[] | {}, options?: QueryOptions & Stream): Promise<stream.Readable>
    findWhere(where: string, params: any, options?: any): Promise<any> 

    findAll(options?: QueryOptions): Promise<T[]>
    findAll(options?: QueryOptions & Stream): Promise<stream.Readable>
    findAll(options?: any): Promise<any> 

    findOne(conditions, options?: QueryOptions): Promise<T> 

    findFirst(conditions, options?: QueryOptions): Promise<T> 

    count(conditions?: {}, options?: CountOption): Promise<number> 

    findOneFieldOnly(conditions, field: string, options?: QueryOptions): Promise<any> 

}
