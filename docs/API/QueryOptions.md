##Query options
Query option has to follow the following interface:

```js
interface QueryOptions {
    limit?:number;
    offset?: number;
    orderBy?:string|string[];//free text or column list
    groupBy?:string|string[];//free text or column list
    fields?: string|string[];//free text or column list
    logger?:PgDbLogger;
}
```
where orderBy/groupBy/fields can be either an array (in that case will get quotation if needed) 
or a free text string with all the possibilities.

logger can be specified for this query only. Please note, that at the moment, only one logger is used.

```js
let res = await pgdb.find({medal:['gold','silver','bronze']}, {orderBy:'sum(*)', groupBy:['country'], fields:'sum(*) as numberOfMedals, country'});

```
