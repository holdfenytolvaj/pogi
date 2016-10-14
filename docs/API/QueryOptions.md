##SqlQueryOption, InsertOption, UpdateDeleteOption
These all the same yet, you can set logger.
```js
export interface SqlQueryOptions {
    logger?: PgDbLogger;
}
```

## & Return, & Stream
Additional interfaces to set return value type.

With `stream:true` query will return with stream instead of the populated result.

With `return *` insert / update / delete query will return the affected rows (this is the default).

`return string[]` is the same as '*' but only return with the specified columns
```js
export interface Return {
    return?:string[]|'*';
}
export interface Stream {
    stream: true;
}
```

##QueryOptions
Query option has to follow the following interface:

```js
interface QueryOptions {
    limit?:number;
    offset?: number;
    orderBy?: string|string[]|{[fieldName:string]:'asc'|'desc'};//free text or column list
    groupBy?:string|string[];//free text or column list
    fields?: string|string[];//free text or column list
    logger?:PgDbLogger;
}
```
where orderBy/groupBy/fields can be either an array (in that case will get quotation if needed) 
or a free text string with all the possibilities.

logger can be specified for the current query only.

```js
await pgdb.find({medal:['g','s','b']}, {orderBy:'sum(*)', groupBy:['country'], fields:'sum(*) as numberOfMedals, country'});
```
### orderBy
You can do as you like:
```js
await pgdb.find({}, {orderBy:{name:'desc', ageCategory:'asc'}});
await pgdb.find({}, {orderBy:['name desc', 'ageCategory asc']});
await pgdb.find({}, {orderBy:['-name', '+ageCategory']});
await pgdb.find({}, {orderBy:['name', 'ageCategory']});
await pgdb.find({}, {orderBy:'name dec, "ageCategory" asc'});
```
### groupBy
```js
await pgdb.find({}, {groupBy:'name, "ageCategory", count(*)'});
await pgdb.find({}, {groupBy:['name', 'ageCategory', 'count(*)']});
```

