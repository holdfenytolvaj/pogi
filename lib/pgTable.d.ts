import { QueryAble, QueryOptions } from "./queryAble";
import { PgDb, FieldType } from "./pgDb";
import { PgSchema } from "./pgSchema";
export declare class PgTable extends QueryAble {
    schema: PgSchema;
    protected desc: {
        name: string;
        pk: string;
        schema: string;
    };
    qualifiedName: string;
    db: PgDb;
    fieldType: {
        [index: string]: FieldType;
    };
    constructor(schema: PgSchema, desc: {
        name: string;
        pk: string;
        schema: string;
    }, fieldType?: {});
    toString(): string;
    insert(records: Object, returnResult?: boolean): Promise<Object>;
    insert(records: Object[], returnResult?: boolean): Promise<Object[]>;
    /**
     * NOTE-DATE: there are 2 approaches to keep tz (the time correctly):
     *    1) use Date.toISOString() function, but then the $x placeholder should be TIMESTAMP WITH TIME ZONE $x
     *    2) use Date, and then no need to change the placeholder $x
     *    lets use 2)
     */
    private transformInsertUpdateParams(param, fieldType);
    private getUpdateQuery(conditions, fields);
    updateOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }): Promise<number>;
    updateAndGetOne(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }): Promise<any>;
    update(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }): Promise<number>;
    updateAndGet(conditions: {
        [k: string]: any;
    }, fields: {
        [k: string]: any;
    }): Promise<any[]>;
    private getDeleteQuery(conditions);
    deleteAll(): Promise<number>;
    delete(conditions: {
        [k: string]: any;
    }): Promise<number>;
    deleteAndGet(conditions: {
        [k: string]: any;
    }): Promise<any[]>;
    deleteOneAndGet(conditions: {
        [k: string]: any;
    }): Promise<any>;
    deleteOne(conditions: {
        [k: string]: any;
    }): Promise<number>;
    find(conditions: {
        [k: string]: any;
    }, options?: QueryOptions): Promise<any[]>;
    findWhere(where: string, params?: any, options?: QueryOptions): Promise<any[]>;
    findAll(options?: QueryOptions): Promise<any[]>;
    findOne(conditions: any, options?: QueryOptions): Promise<any>;
    findFirst(conditions: any, options?: QueryOptions): Promise<any>;
    count(conditions?: any): Promise<number>;
    findOneFieldOnly(conditions: any, field: string, options?: QueryOptions): Promise<any>;
}
