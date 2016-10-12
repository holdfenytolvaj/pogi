For all the examples below 

```js

import {PgDb, PgSchema, PgTable} from "pogi";

let pgdb:PgDb     = PgDb.connect(..);
let table:PgTable<User> = pgdb.schemas.test1.users;  

export interface InsertOption {
    logger?: PgDbLogger;
}

export interface UpdateDeleteOption {
    logger?: PgDbLogger;
}

export interface TruncateOptions{
    restartIdentity?: boolean,
    cascade?: boolean,
    logger?: PgDbLogger;
}

export interface Return {
    return?:string[]|'*';
}

export interface Stream {
    stream: true;
}


```
#Properties
### <span class="def">db:</span><span class="type">PgDb</span>

#Functions
##toString
<span class="def"><span class="func">toString</span>()</span>

returns the fully qualified name of the table

##setLogger
<span class="def"><span class="func">setLogger</span>(logger:<span class="type">PgDbLogger</span>) </span>

Note: inherited.

Sets the logger per table (not used if the query has logger specified).

#Functions - async

## count
<span class="def"><span class="func">count</span>(conditions?:<span class="type">{}</span>):Promise&lt;<span class="type">number</span>&gt;<span class="type">

Run a count query
```js
let count = await table.count({id:2});
console.log(count); //most probably 1
```

---
## delete
<span class="def"><span class="func">delete</span>(conditions:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption</span>):Promise&lt;<span class="type">number</span>&gt;</span>

Executes a delete-where query.

```js
let numberOfRowsDeleted = await table.delete({id:[1,2,3]});
if (numberOfRowsDeleted!=3) {
    //alarm!!
}
```

---
## deleteOne
<span class="def"><span class="func">deleteOne</span>(conditions:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption</span>):Promise&lt;<span class="type">number</span>&gt;</span>

Executes a delete-where query, but throws exception if more then one record is deleted;
```js
let numberOfDeleted = await table.deleteOne({id:[1,2,3]}); //throws exception if more then one record is deleted
console.log(numberOfDeleted); //0 or 1
```

---
## deleteAndGet
<span class="def"><span class="func">deleteAndGet</span>(conditions:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption & Return</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

Executes a delete-where query and returns with the deleted records;
```js
let playersDeleted = await table.deleteAndGet({id:[1,2,3]});
for (let player of playersDeleted) {
    console.log(player.id); //1 then 2 then 3
}
```

---
## deleteAndGetOne
<span class="def"><span class="func">deleteAndGetOne</span>(conditions:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption & Return</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

Executes a delete-where query, but throws exception if more then one record is deleted;
Returns with the deleted record if any.
```js
let playerDeleted = await table.deleteAndGet({id:[1,2,3]});  //throws exception if more then one record is deleted
console.log(player.id); //Either 1, 2, 3 or null if no record is deleted

```

---
## find
<span class="def"><span class="func">find</span>(conditions:<span class="type">{}</span>, options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

<span class="def"><span class="func">find</span>(conditions:<span class="type">{}</span>, options?:<span class="type">QueryOptions & Stream</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

Executes a select-where query.
```js

let playerList = await table.find({id:[1,2,3]});
for (let player of playerList) {
    console.log(player.id); //1..2..3
}

playerList = await table.find({id:[1,2,3]}, {fields:['id', 'name'], limit:3});

```
for more options for [conditions](condition) and [queryOptions](QueryOptions) see those sections.

If the option has `{stream:true}` parameter it returns a stream instead of an array. 
See [streams](/streams) for example. 


---
## findWhere
<span class="def"><span class="func">findWhere</span>(where:<span class="type">string</span>,params:<span class="type">any[]|{}</span>,options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">ReadableStream</span>&gt;</span>

<span class="def"><span class="func">findWhere</span>(where:<span class="type">string</span>,params:<span class="type">any[]|{}</span>,options?:<span class="type">QueryOptions & Stream</span>):Promise&lt;<span class="type">ReadableStream</span>&gt;</span>

Executes a select-where query with free text where etc. 
```js

let res;

res = await table.where("permissions @&gt; {'admin'} AND name!=username AND id=$1  LIMIT 2", [1]);

res = await table.where("permissions @&gt; {'admin'} AND name!=username AND id=:id LIMIT 2", {id:1});

```

If the option has `{stream:true}` parameter it returns a stream instead of an array. 
See [streams](/streams) for example. 


---
## findAll
<span class="def"><span class="func">findAll</span>(options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

<span class="def"><span class="func">findAll</span>(options?:<span class="type">QueryOptions & Stream</span>):Promise&lt;<span class="type">ReadableStream</span>&gt;</span>

Returns everything from the table. Same as table.find({})
```js
let res = await table.findAll();
```

If the option has `{stream:true}` parameter it returns a stream instead of an array. 
See [streams](/streams) for example. 



---
## findOne
<span class="def"><span class="func">findOne</span>(conditions, options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">T</span>&gt;</span>

Most system get this wrong, as they use it as "_findFirst_" instead of using as "_findOnly_". 
While 99% of the time the programmer means the latter, by default they use the formal.
That is mostly just hiding bugs instead of revealing issues as soon as possible. 
It's hard to count how much time it saved me to find an issue, not to mention that it found earlier 
then otherwise would find out. Very good investment for a small bit of _Defensive programming_.

Therefore it **throws exception** if more then one record match the select query.
```js
let res1 = await table.findOne({id:1});
let res2 = await table.findOne({'name like': 'A%'}); //most probably throws an exception
```

---
## findFirst
<span class="def"><span class="func">findFirst</span>(conditions, options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">T</span>&gt;</span>

Same as await table.find(condition, {limit:1})
```js
let somebody = await table.findFirst({'score &gt;':9000});
```

---
## findOneFieldOnly
<span class="def"><span class="func">findOneFieldOnly</span>(conditions:<span class="type">{}</span>, field:<span class="type">string</span>, options?:<span class="type">QueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;</span>

Returns directly the value of a column/field directly.

```js
let nameOfUser = await table.findOneFieldOnly({id:1}, 'name');
console.log(nameOfUser); //most probably 'Admin'
```

---
## insert
<span class="def"><span class="func">insert</span>(records:<span class="type">T</span>, options:<span class="type">InsertOption</span>): Promise&lt;<span class="type">T</span>&gt;</span>

<span class="def"><span class="func">insert</span>(records:<span class="type">T[]</span>, options:<span class="type">InsertOption</span>): Promise&lt;<span class="type">T[]</span>&gt;</span>

You can insert one or multiple records, by default the new record(s) will be returned. This can be prevented if not needed;
```js
let user = await table.insert({username:'anonymous'}); //returns the whole record
console.log(user.id); // generated by postgresql
//or
let userList = await table.insert([{username:'anonymous'},{username:'anonymous2'}], {return:['id']});
console.log(userList[0].id); // generated by postgresql

await table.insert({username:'anonymous2'}, {return:[]}); //returns [{}]

```

---
## insertAndGet
<span class="def"><span class="func">insert</span>(records:<span class="type">T</span>, options:<span class="type">InsertOption & Return</span>): Promise&lt;<span class="type">T</span>&gt;</span>

<span class="def"><span class="func">insert</span>(records:<span class="type">T[]</span>, options:<span class="type">InsertOption & Return</span>): Promise&lt;<span class="type">T[]</span>&gt;</span>

You can insert one or multiple records, by default the new record(s) will be returned. This can be prevented if not needed;
```js
let user = await table.insert({username:'anonymous'}); //returns the whole record
console.log(user.id); // generated by postgresql
//or
let userList = await table.insert([{username:'anonymous'},{username:'anonymous2'}], {return:['id']});
console.log(userList[0].id); // generated by postgresql

await table.insert({username:'anonymous2'}, {return:[]}); //returns [{}]

```

---
## update
<span class="def"><span class="func">update</span>(conditions:<span class="type">{}</span>, fields:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption</span>):Promise&lt;<span class="type">number</span>&gt;</span>

Run an update query on the table, returns the number of records changed.
```js
await table.update({},{score:null}); //all record is updated
await table.update({'name ~': '^G'}, {numOfLifes:4}); //all record where name starts with G has the numOfLifes set to 4. It's a G'day!
```

---
## updateOne
<span class="def"><span class="func">updateOne</span>(conditions:<span class="type">{}</span>, fields:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption</span>): Promise&lt;<span class="type">number</span>&gt;</span>

Run an update query, throws exception if more then one record has been updated. (Handy if you roll back on exception)
```js
await table.updateOne({id:1},{password:null});
await table.updateOne({notUniqId:1},{password:null}); //throws exception if more then 1 rec has been updated;
```

---
## updateAndGet
<span class="def"><span class="func">updateAndGet</span>(conditions:<span class="type">{}</span>, fields:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption & Return</span>):Promise&lt;<span class="type">T[]</span>&gt;</span>

Run an update query on the table
```js
let playerList = await table.updateAndGet({'score &gt;': '9000'}, {achivement:"It's Over 9000!"}); 
//update the achievement fields for all players where the score is over 9000 then returns the updated list

let playerIdList = await table.updateAndGet({'score &gt;': '9000'}, {achivement:"It's Over 9000!"}, {return:['id']});
```

---
## updateAndGetOne
<span class="def"><span class="func">updateAndGetOne</span>(conditions:<span class="type">{}</span>, fields:<span class="type">{}</span>, options?:<span class="type">UpdateDeleteOption & Return</span>): Promise&lt;<span class="type">T</span>&gt;</span>

Run an update query and returns with the updated record, 
throws exception if more then one record has been updated. (Handy if you roll back on exception)
```js
let user = await table.updateOne({id:1},{password:null});
console.log(user.name); //the whole record is returned
```


---
##query
<span class="def"><span class="func">query</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

<a name="query"></a>
Note: inherited, uses table level log if present (if not then schema, then db).

Executes an arbitrary sql string with parameters / named parameters;
```js

let res1 = await table.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await table.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});

```
---
## queryOneField
<span class="def"><span class="func">queryOneField</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js

let winner = await table.getOneField(`SELECT 'The winner is ' || name FROM ${table} LIMIT 1`);
console.log(winner); //The winner is Admin

```
---
## queryOneColumn
<span class="def"><span class="func">queryOneColumn</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js

let userList = await table.getOneColumn(`SELECT name FROM ${table}`);
console.dir(userList); //['Admin', 'User1', 'User2']

```
---
## queryAsStream
<span class="def"><span class="func">queryAsStream</span>(sql:<span class="type">string</span>, params?:<span class="type">any[]|{}</span>, options?:<span class="type">SqlQueryOptions</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

see [streams](/streams)

---
##run
<span class="def"><span class="func">run</span>(sql:<span class="type">string</span>):Promise&lt;<span class="type">any[]</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

Executes an arbitrary sql string;
```js

await table.run('CREATE schema myschema');

```








