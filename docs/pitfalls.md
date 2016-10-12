
## Known pitfalls
>Nothing is without pitfalls, but for most libraries it's well hidden...

### postgre data types vs javascript types - general
pg.js is a powerful library but left many decision to the user, e.g. converting types. 
By default it doesn't convert arrays or integers, dates are also tricky. We've added some basic 
types, but rarely used types (e.g. date-ranges, custom complex types) still need to be converted.

### postgre data types vs javascript types - number
Javacript does not handle integers precisely out of range [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
and this is why it is not converted by default by pg.js, but its rarely reached,
thus it is safe to convert by default, and just throw an exception when it is above that number (9007199254740991); 

### postgre data types vs javascript types - date
e.g. when you write your own queries, do not do this:
```js
let date = new Date().toISOString();
await pgdb.query(`SELECT * FROM users where created>'${date}'`);
```
this equals to (or something similar depending on your timezone):
```sql
select * from users where created>'1999-12-31T18:00:00.000Z';
```
it will have some side effect as postgre will compare them as a string, so you need to enforce the conversion:
```js
await pgdb.query(`SELECT * FROM users where created>'${date}'::timestamptz`);
//or 
await userTable.find({'created >':date});
await userTable.find({'created >': new Date()});//no need for toISOString()
```
this equals to:
```sql
select * from users where created>'2000-01-01 00:00:00';
```

### Table or column type change / truncate
If a column type changes or truncates occur (truncate needs a double check, it might be possible), 
the postgres data type's oid numbers might changes, after
these queries the pgdb needs to rerun the initial column type queries. 
This can be done as easy as 
```js
await pgdb.reload();
```

### Results' object constructor
Result objects have a special constructor that are not callable outside pg.js. 
It's rarely an issue, except e.g. if you use xlsx npm package, where after cloning 
the object, it calls the object's constructor it can cause some issues

### Connectivity(?)
See [pg-ka-fix](https://github.com/numminorihsf/pg-ka-fix). Haven't met with the issue,
but need to investigate, leave it here as a possible issue. 

### Field name collision
Result fields do not keep their table alias references, so the following query will result
in name collision:
```js
    await pgdb.query(`select u1.id, u2.id from ${table} u1 left join ${table} u2 ON true `);
```
not a big issue, just needs aliases, but keep in mind. In case this happens an exception will be thrown.
