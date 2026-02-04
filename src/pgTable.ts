import _ from 'lodash';
import stream from "stream";
import { PgDb } from './index.js';
import { FieldType } from "./pgDb.js";
import { PgSchema } from "./pgSchema.js";
import { CountOption, InsertOption, Return, Stream, TruncateOptions, UpdateDeleteOption, UpsertOption } from "./pgTableInterface.js";
import { pgUtils } from "./pgUtils.js";
import { QueryAble } from "./queryAble.js";
import { QueryOptions } from "./queryAbleInterface.js";
import generateWhere from "./queryWhere.js";

export class PgTable<T> extends QueryAble {
    qualifiedName: string;
    pkey: string;
    db: PgDb;
    fieldTypes: { [index: string]: FieldType }; //written directly

    constructor(public schema: PgSchema, protected desc: { name: string, pkey?: string, schema: string }, fieldTypes: Record<string, FieldType> = {}) {
        super();
        this.db = schema.db;
        this.qualifiedName = `${pgUtils.quoteFieldName(desc.schema)}.${pgUtils.quoteFieldName(desc.name)}`;
        this.pkey = desc.pkey || desc.name + "_pkey"; //poor man's pkey (could be queried by why?)
        this.fieldTypes = fieldTypes;
        return this
    }

    toString() {
        return this.qualifiedName;
    }

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
    async insert(records: T[], options?: InsertOption): Promise<number>
    async insert(records: T, options?: InsertOption): Promise<number>
    async insert(records: any, options?: any): Promise<any> {
        options = options || {};

        if (!records) {
            throw new Error("insert should be called with data");
        } else if (!Array.isArray(records)) {
            records = [records];
        } else if (records.length === 0) {
            return 0;  // just return empty arrays so bulk inserting variable-length lists is more friendly
        }

        let { sql, parameters } = this.getInsertQuery(records);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let result = await this.query(sql, parameters, { logger: options.logger });
        return result[0].sum;
    }

    async insertAndGet(records: T[], options?: InsertOption & Return): Promise<T[]>
    async insertAndGet(records: T, options?: InsertOption & Return): Promise<T>
    async insertAndGet(records: any, options?: InsertOption & Return): Promise<any> {
        let returnSingle = false;
        options = options || {};

        if (!records) {
            throw new Error("insert should be called with data");
        } else if (!Array.isArray(records)) {
            returnSingle = true;
            records = [records];
        } else if (records.length === 0) {
            return [];  // just return empty arrays so bulk inserting variable-length lists is more friendly
        }

        let { sql, parameters } = this.getInsertQuery(records);

        sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils.quoteFieldName).join(',') : '*');

        let result = await this.query(sql, parameters, { logger: options.logger });
        if (options.return && options.return.length == 0) {
            return new Array(returnSingle ? 1 : records.length).fill({});
        }
        if (returnSingle) {
            return result[0];
        } else {
            return result;
        }
    };

    async updateOne(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> {
        let affected = await this.update(conditions, fields, options);
        if (affected > 1) {
            throw new Error('More then one record has been updated!');
        }
        return affected;
    }

    async updateAndGetOne(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<T> {
        let result = await this.updateAndGet(conditions, fields, options);
        if (result.length > 1) {
            throw new Error('More then one record has been updated!');
        }
        return result[0];
    }

    async update(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> {
        let { sql, parameters } = this.getUpdateQuery(conditions, fields, options);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let res = await this.query(sql, parameters, options);
        return res[0].sum;
    };

    async updateAndGet(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<T[]> {
        let { sql, parameters } = this.getUpdateQuery(conditions, fields, options);
        sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils.quoteFieldName).join(',') : '*');
        return this.query(sql, parameters, options);
    };

    /**
     * columnsOrConstraintName is by default the primary key
     */
    async upsert(record: T, options?: UpsertOption): Promise<number> {
        options = options || {};
        if (!record) {
            throw new Error("insert should be called with data");
        }

        let { sql, parameters } = this.getUpsertQuery(record, options);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let result = await this.query(sql, parameters, { logger: options.logger });
        return result[0].sum;
    };

    /**
     * columnsOrConstraintName is by default the primary key
     */
    async upsertAndGet(record: T, options?: UpsertOption & Return): Promise<T> {
        options = options || {};
        if (!record) {
            throw new Error("insert should be called with data");
        }

        let { sql, parameters } = this.getUpsertQuery(record, options);
        sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils.quoteFieldName).join(',') : '*');

        let result = await this.query(sql, parameters, { logger: options.logger });

        if (options.return && options.return.length == 0) {
            return <T>{};
        }
        return result[0];
    };

    async delete(conditions: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> {
        let { sql, parameters } = this.getDeleteQuery(conditions, options);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let res = await this.query(sql, parameters, options);
        return res[0].sum;
    }

    async deleteOne(conditions: { [k: string]: any }, options?: UpdateDeleteOption): Promise<number> {
        let affected = await this.delete(conditions, options);
        if (affected > 1) {
            throw new Error('More then one record has been deleted!');
        }
        return affected;
    }

    async deleteAndGet(conditions: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<any[]> {
        options = options || {};
        let { sql, parameters } = this.getDeleteQuery(conditions, options);
        sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils.quoteFieldName).join(',') : '*');
        return this.query(sql, parameters);
    }

    async deleteAndGetOne(conditions: { [k: string]: any }, options?: UpdateDeleteOption & Return): Promise<any> {
        let result = await this.deleteAndGet(conditions, options);
        if (result.length > 1) {
            throw new Error('More then one record has been deleted!');
        }
        return result[0];
    }

    // async deleteAll(options?:UpdateDeleteOption):Promise<number> {
    //     let sql = util.format("DELETE FROM %s ", this.qualifiedName);
    //     sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
    //     let res = await this.query(sql, {logger:options.logger});
    //     return res[0].sum;
    // }

    async truncate(options?: TruncateOptions): Promise<void> {
        let sql = `TRUNCATE ${this.qualifiedName}`;
        if (options && options.restartIdentity) {
            sql += ' RESTART IDENTITY';
        }
        if (options && options.cascade) {
            sql += ' CASCADE';
        }
        await this.query(sql, undefined, options);
    }

    async find(conditions: { [k: string]: any }, options?: QueryOptions): Promise<T[]>
    async find(conditions: { [k: string]: any }, options?: QueryOptions & Stream): Promise<stream.Readable>
    async find(conditions: { [k: string]: any }, options?: any): Promise<any> {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined && ['all', 'select'].includes(this.db.config.skipUndefined));
        let where = _.isEmpty(conditions) ? {
            where: "",
            params: undefined
        } : generateWhere(conditions, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
        let sql = `SELECT ${pgUtils.processQueryFields(options, this)} FROM ${this.qualifiedName} ${where.where} ${pgUtils.processQueryOptions<T>(options, this)}`;
        return options.stream ? this.queryAsStream(sql, where.params, options) : this.query(sql, where.params, options);
    }


    async findWhere(where: string, params: any[] | {}, options?: QueryOptions): Promise<T[]>
    async findWhere(where: string, params: any[] | {}, options?: QueryOptions & Stream): Promise<stream.Readable>
    async findWhere(where: string, params: any, options?: any): Promise<any> {
        options = options || {};
        let sql = `SELECT ${pgUtils.processQueryFields(options, this)} FROM ${this.qualifiedName} WHERE ${where} ${pgUtils.processQueryOptions<T>(options, this)}`;
        return options.stream ? this.queryAsStream(sql, params, options) : this.query(sql, params, options);
    }

    public async findAll(options?: QueryOptions): Promise<T[]>
    public async findAll(options?: QueryOptions & Stream): Promise<stream.Readable>
    public async findAll(options?: any): Promise<any> {
        options = options || {};
        let sql = `SELECT ${pgUtils.processQueryFields(options, this)} FROM ${this.qualifiedName} ${pgUtils.processQueryOptions<T>(options, this)}`;
        return options.stream ? this.queryAsStream(sql, undefined, options) : this.query(sql, null, options);
    }

    async findOne(conditions: Record<string, any>, options?: QueryOptions): Promise<T> {
        let res = await this.find(conditions, options);
        if (res.length > 1) {
            let logger = (options && options.logger || this.getLogger(false));
            let error = new Error('More then one rows exists');
            pgUtils.logError(logger, { error, sql: this.qualifiedName, params: conditions, connection: this.db.connection });
            throw error;
        }
        return res[0];
    }

    async findFirst(conditions: Record<string, any>, options?: QueryOptions): Promise<T> {
        options = options || {};
        options.limit = 1;
        let res = await this.find(conditions, options);
        return res[0];
    }


    async count(conditions?: Record<string, any>, options?: CountOption): Promise<number> {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined && ['all', 'select'].includes(this.db.config.skipUndefined));

        let where = _.isEmpty(conditions) ? {
            where: " ",
            params: undefined
        } : generateWhere(conditions!, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
        let sql = `SELECT COUNT(*) c FROM ${this.qualifiedName} ${where.where}`;
        return (await this.queryOneField(sql, where.params));
    }

    async findOneFieldOnly(conditions: Record<string, any>, field: string, options?: QueryOptions): Promise<any> {
        options = options || {};
        options.fields = [field];
        let res = await this.findOne(conditions, options);
        return res ? res[field] : null;
    }


    private getInsertQuery<T extends object>(records: T[]) {
        let columnsMap = <Record<keyof T, boolean>>{};
        records.forEach(rec => {
            for (let field in rec) {
                columnsMap[field] = true;
            }
        });
        let columns = Object.keys(columnsMap);
        let sql = `INSERT INTO ${this.qualifiedName} (${columns.map(pgUtils.quoteFieldName).join(", ")}) VALUES\n`;
        let parameters: string[] = [];
        let placeholders: string[] = [];

        for (let i = 0, seed = 0; i < records.length; i++) {
            placeholders.push('(' + columns.map(c => "$" + (++seed)).join(', ') + ')');
            parameters.push(...columns.map(c => pgUtils.transformInsertUpdateParams(records[i][c], this.fieldTypes[c])));
        }
        sql += placeholders.join(",\n");

        return { sql, parameters };

    }

    protected getUpdateSetSnippet(fields: { [k: string]: any }, parameters?: any[]): { snippet: string, parameters: any[] } {
        let params = parameters || [];
        let f: string[] = [];
        let seed = params.length;

        _.each(fields, (value, fieldName) => {
            if (value === undefined) return;

            f.push(`${pgUtils.quoteFieldName(fieldName)} = $${(++seed)}`);
            params.push(pgUtils.transformInsertUpdateParams(value, this.fieldTypes[fieldName]));
        });

        return { snippet: f.join(', '), parameters: params };
    }

    protected getUpdateQuery(conditions: { [k: string]: any }, fields: { [k: string]: any }, options?: UpdateDeleteOption): { sql: string, parameters: any[] } {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined === 'all');

        let hasConditions = true;

        if (_.isEmpty(fields)) {
            throw new Error('Missing fields for update');
        }

        let { snippet, parameters } = this.getUpdateSetSnippet(fields);
        let sql = `UPDATE ${this.qualifiedName} SET ${snippet}`;

        if (!hasConditions || !_.isEmpty(conditions)) {
            let parsedWhere = generateWhere(conditions, this.fieldTypes, this.qualifiedName, parameters.length, options.skipUndefined);
            sql += parsedWhere.where;
            parameters = parameters.concat(parsedWhere.params);
        }
        return { sql, parameters };
    }

    protected getUpsertQuery<T extends object>(record: T, options?: UpsertOption): { sql: string, parameters: any[] } {
        options = options || {};

        if (_.isEmpty(record)) {
            throw new Error('Missing fields for upsert');
        }

        let insert = this.getInsertQuery([record]);
        let { snippet, parameters } = this.getUpdateSetSnippet(record, insert.parameters);
        let sql = insert.sql;

        if (options.columns) {
            sql += ` ON CONFLICT (${options.columns.map(c => pgUtils.quoteFieldName(c)).join(', ')}) DO UPDATE SET ${snippet}`;
        } else {
            let constraint = pgUtils.quoteFieldName(options.constraint || this.pkey);
            sql += ` ON CONFLICT ON CONSTRAINT ${constraint} DO UPDATE SET ${snippet}`;
        }

        return { sql, parameters };
    }

    protected getDeleteQuery(conditions: { [k: string]: any }, options?: UpdateDeleteOption): { sql: string, parameters: any[] } {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined === 'all');

        let sql = `DELETE FROM ${this.qualifiedName} `;

        let parsedWhere;
        if (!_.isEmpty(conditions)) {
            parsedWhere = generateWhere(conditions, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
            sql += parsedWhere.where;
        }
        return { sql, parameters: parsedWhere && parsedWhere.params || [] }
    }
}
