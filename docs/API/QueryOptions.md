##SqlQueryOption, InsertOption
You can set the logger.
```js
export interface SqlQueryOptions {
    logger?: PgDbLogger;
}
```

##QueryOptions
Query (`select`) option has to follow the following interface:

```js
interface QueryOptions {
    limit?:number;
    offset?: number;
    orderBy?: string|string[]|{[fieldName:string]:'asc'|'desc'};//free text or column list
    groupBy?:string|string[]; //free text or column list
    fields?: string|string[]; //free text or column list
    skipUndefined?:boolean;   //if there is an undefined value in the conditions, shall it be skipped. Default raise error.
    logger?:PgDbLogger;
    distinct?: boolean;       // SELECT DISTINCT statement
    forUpdate?: boolean;      // FOR UPDATE statement
}
```
where orderBy/groupBy/fields can be either an array (in that case will get quotation if needed) 
or a free text string with all the possibilities.

logger can be specified for the current query only.

```js
await pgdb.users.find({medal:['g','s','b']}, {orderBy:'sum(*)', groupBy:['country'], fields:'sum(*) as numberOfMedals, country'});
```
### orderBy
You can do as you like:
```js
await pgdb.users.find({}, {orderBy:{name:'desc', ageCategory:'asc'}});
await pgdb.users.find({}, {orderBy:['name desc', 'ageCategory asc']});
await pgdb.users.find({}, {orderBy:['-name', '+ageCategory']});
await pgdb.users.find({}, {orderBy:['name', 'ageCategory']});
await pgdb.users.find({}, {orderBy:'name dec, "ageCategory" asc'});
```
### groupBy
```js
await pgdb.users.find({}, {groupBy:'name, "ageCategory", count(*)'});
await pgdb.users.find({}, {groupBy:['name', 'ageCategory', 'count(*)']});
```

### skipUndefined
```js
await pgdb.users.find({}, {name:'joe', password:undefined}); //raise error
await pgdb.users.find({}, {name:'joe', password:undefined}, {skipUndefined:true}); //return the record with name 'joe'
```

##UpdateDeleteOption
```js
export interface SqlQueryOptions {
    skipUndefined?:boolean; //if there is an undefined value in the conditions, shall it be skipped. Default raise error.
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
