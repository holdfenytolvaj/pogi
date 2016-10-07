import {QueryAble, QueryOptions} from "./queryAble";

import {PgDb, FieldType} from "./pgDb";
import generateWhere from "./queryWhere";
import {PgSchema} from "./pgSchema";
import {pgUtils} from "./pgUtils";
var util = require('util');
var _ = require('lodash');

interface InsertOption {
    return?:string[]|boolean;
}

export class PgTable extends QueryAble {
    qualifiedName:string;
    db:PgDb;
    public fieldTypes:{[index:string]:FieldType};

    constructor(public schema:PgSchema, protected desc:{name:string, pk:string, schema:string}, fieldTypes={}) {
        super();
        this.db = schema.db;
        this.qualifiedName = util.format('"%s"."%s"', desc.schema, desc.name);
        this.fieldTypes = fieldTypes;
    }

    public toString() {
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
    public async insert<T>(records:T,   options?:InsertOption ): Promise<T>
    public async insert<T>(records:T[], options?:InsertOption ): Promise<T[]>
    public async insert<T>(records:any, options?:InsertOption ): Promise<any> {
        var returnSingle = false;

        if (!records) {
            throw new Error("insert should be called with data");
        } else if (!Array.isArray(records)) {
            returnSingle = true;
            records = [records];
        } else if (records.length === 0) {
            return [];  // just return empty arrays so bulk inserting variable-length lists is more friendly
        }

        let delimitedColumnNames = _.map(_.keys(records[0]), (fieldName) => util.format('"%s"', fieldName));
        let sql = util.format("INSERT INTO %s (%s) VALUES\n", this.qualifiedName, delimitedColumnNames.join(", "));
        let parameters = [];
        let values = [];

        for (var i = 0, seed = 0; i < records.length; ++i) {
            values.push(util.format('(%s)', _.map(records[i], () => "$" + (++seed)).join(', ')));
            _.forEach(records[i], (param, fieldName) => {
                parameters.push(this.transformInsertUpdateParams(param, this.fieldTypes[fieldName]));
            });
        }
        sql += values.join(",\n");
        if (!options || options.return) {
            if (Array.isArray(options.return)) {
                sql += " RETURNING " + (<Array>options.return).join(',');
            } else {
                sql += " RETURNING *";
            }
        }
        let result = await this.query(sql, parameters);
        if (options && !options.return) {
            return;
        }
        if (returnSingle) {
            return result[0];
        } else {
            return result;
        }
    };

    /**
     * NOTE-DATE: there are 2 approaches to keep tz (the time correctly):
     *    1) use Date.toISOString() function, but then the $x placeholder should be TIMESTAMP WITH TIME ZONE $x
     *    2) use Date, and then no need to change the placeholder $x
     *    lets use 2)
     */
    private transformInsertUpdateParams(param:any, fieldType:FieldType) {
        return (param!=null && fieldType==FieldType.JSON) ? JSON.stringify(param) :
            (param!=null && fieldType==FieldType.TIME && !(param instanceof Date)) ? new Date(param) : param;
    }

    private getUpdateQuery(conditions:{[k:string]:any}, fields:{[k:string]:any}):{sql:string, parameters:any[]} {
        var hasConditions = true;

        if (_.isEmpty(fields)) {
            throw new Error('Missing fields for update');
        }

        let parameters = [];
        let f = [];
        let seed = 0;

        _.each(fields, (value, fieldName) => {
            if (value === undefined) return;

            f.push(util.format('%s = $%s', pgUtils.quoteField(fieldName), (++seed)));
            parameters.push(this.transformInsertUpdateParams(value, this.fieldType[fieldName]));
        });

        let sql = util.format("UPDATE %s SET %s", this.qualifiedName, f.join(', '));

        if (!hasConditions || !_.isEmpty(conditions)) {
            var parsedWhere = generateWhere(conditions, this.fieldTypes, this.qualifiedName, parameters.length);
            sql += parsedWhere.where;
        }
        parameters = parameters.concat(_.flatten(_.values(conditions).filter(v=>v!==undefined)));
        return {sql, parameters};
    }

    public async updateOne(conditions:{[k:string]:any}, fields:{[k:string]:any}): Promise<number> {
        let affected = await this.update(conditions,fields);
        if (affected > 1) {
            throw new Error('More then one record has been updated!');
        }
        return affected;
    }

    public async updateAndGetOne(conditions:{[k:string]:any}, fields:{[k:string]:any}): Promise<any> {
        let result = await this.updateAndGet(conditions, fields);
        if (result.length > 1) {
            throw new Error('More then one record has been updated!');
        }
        return result[0];
    }

    public async update(conditions:{[k:string]:any}, fields:{[k:string]:any}):Promise<number> {
        let {sql, parameters} = this.getUpdateQuery(conditions, fields);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let res = await this.query(sql, parameters);
        return +res[0].sum;
    };

    public async updateAndGet(conditions:{[k:string]:any}, fields:{[k:string]:any}):Promise<any[]> {
        let {sql, parameters} = this.getUpdateQuery(conditions, fields);
        sql += " RETURNING *";
        return this.query(sql, parameters);
    };

    private getDeleteQuery(conditions:{[k:string]:any}):{sql:string, parameters:any[]} {
        let sql = util.format("DELETE FROM %s ", this.qualifiedName);

        var parsedWhere;
        if (!_.isEmpty(conditions)) {
            parsedWhere = generateWhere(conditions, this.fieldTypes, this.qualifiedName);
            sql += parsedWhere.where;
        }
        return {sql, parameters:parsedWhere.params||[]}
    }

    public async delete(conditions:{[k:string]:any}):Promise<number> {
        let {sql, parameters} = this.getDeleteQuery(conditions);
        sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
        let res = await this.query(sql, parameters);
        return +res[0].sum;
    }

    public async deleteAndGet(conditions:{[k:string]:any}):Promise<any[]> {
        let {sql, parameters} = this.getDeleteQuery(conditions);
        sql += " RETURNING *";
        return this.query(sql, parameters);
    }

    public async deleteOneAndGet(conditions:{[k:string]:any}): Promise<any> {
        let result = await this.deleteAndGet(conditions);
        if (result.length > 1) {
            throw new Error('More then one record has been deleted!');
        }
        return result[0];
    }

    public async deleteOne(conditions:{[k:string]:any}):Promise<number> {
        let affected = await this.delete(conditions);
        if (affected > 1) {
            throw new Error('More then one record has been deleted!');
        }
        return affected;
    }

    public async find(conditions:{[k:string]:any}, options?:QueryOptions):Promise<any[]> {
        let where = _.isEmpty(conditions) ? {where: " ", params: null} : generateWhere(conditions, this.fieldTypes, this.qualifiedName);
        let sql = 'SELECT'
            + pgUtils.processQueryFields(options)
            + ' FROM ' + this.qualifiedName
            + (where.where ? where.where : '')
            + pgUtils.processQueryOptions(options);
        return this.query(sql, where.params);
    }

    public async findWhere(where:string, params?, options?:QueryOptions):Promise<any[]> {
        let sql = `SELECT ${pgUtils.processQueryFields(options)} FROM ${this.qualifiedName} WHERE ${where} ${pgUtils.processQueryOptions(options)}`;
        return this.query(sql, params);
    }

    public async findAll(options?:QueryOptions):Promise<any[]> {
        let sql = `SELECT ${pgUtils.processQueryFields(options)} FROM ${this.qualifiedName} ${pgUtils.processQueryOptions(options)}`;
        return this.query(sql);
    }

    public async findOne(conditions, options?:QueryOptions):Promise<any> {
        let res = await this.find(conditions, options);
        if (res.length > 1) {
            throw new Error('More then one rows exists');
        }
        return res[0];
    }

    public async findFirst(conditions, options?:QueryOptions):Promise<any> {
        options = options || {};
        options.limit = 1;
        let res = await this.find(conditions, options);
        return res[0];
    }

    public async count(conditions?):Promise<number> {
        var where = _.isEmpty(conditions) ? {where: " ", params: null} : generateWhere(conditions, this.fieldTypes, this.qualifiedName);
        var sql = "SELECT COUNT(*) c FROM " + this.qualifiedName + where.where;
        return (await this.getOneField(sql, where.params));
    }

    public async findOneFieldOnly(conditions, field:string, options?:QueryOptions):Promise<any> {
        options = options || {};
        options.fields = [field];
        let res = await this.findOne(conditions, options);
        return res ? res[field] : null;
    }
}
