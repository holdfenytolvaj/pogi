For all the examples below 

```js

import {PgDb, PgSchema, PgTable} from "pgdb/lib/index";

let pgdb:PgDb     = PgDb.connect(..);
let table:PgTable<User> = pgdb.schemas.test1.users;  

```
##Properties
### <span style="color:purple">db:</span><span style="color:orange">PgDb</span>

##Functions
###`toString`
><span style="color:purple"><span style="color:black">toString</span>()</span>

returns the fully qualified name of the table

###`setLogger`
><span style="color:purple"><span style="color:black">setLogger</span>(logger:<span style="color:orange">PgDbLogger</span>) </span>

Note: inherited.

Sets the logger per table (not used if the query has logger specified).

##Functions - async
###`run`
><span style="color:purple"><span style="color:black">run</span>(sql:<span style="color:orange">string</span>):Promise&lt;<span style="color:orange">any[]</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

Executes an arbitrary sql string;
```js

await table.run('CREATE schema myschema');

```

###`query`
><span style="color:purple"><span style="color:black">query</span>(sql:<span style="color:orange">string</span>, params?:<span style="color:orange">any[]|{}</span>, options?:<span style="color:orange">SqlQueryOptions</span>):Promise&lt;<span style="color:orange">any[]</span>&gt;</span>

<a name="query"></a>
Note: inherited, uses table level log if present (if not then schema, then db).

Executes an arbitrary sql string with parameters / named parameters;
```js

let res1 = await table.query('SELECT MAX(point) from game1.scores WHERE name=$1 ', ['player1']);
let res2 = await table.query('SELECT MAX(point) from !:schema.scores WHERE name=:name ', {schema:'game1', name:'player1'});

```

### queryOneField
<span style="color:purple"><span style="color:black">queryOneField</span>(sql:<span style="color:orange">string</span>, params?:<span style="color:orange">any[]|{}</span>, options?:<span style="color:orange">SqlQueryOptions</span>):Promise&lt;<span style="color:orange">any</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

If there is only one record and one field that we are interested in. For the params usage see [query](#query).
```js

let winner = await table.getOneField(`SELECT 'The winner is ' || name FROM ${table} LIMIT 1`);
console.log(winner); //The winner is Admin

```

### queryOneColumn
<span style="color:purple"><span style="color:black">queryOneColumn</span>(sql:<span style="color:orange">string</span>, params?:<span style="color:orange">any[]|{}</span>, options?:<span style="color:orange">SqlQueryOptions</span>):Promise&lt;<span style="color:orange">any[]</span>&gt;</span>

Note: inherited, uses table level log if present (if not then schema, then db).

If there is only one column that we are interested in. For the params usage see [query](#query).
```js

let userList = await table.getOneColumn(`SELECT name FROM ${table}`);
console.dir(userList); //['Admin', 'User1', 'User2']

```
### queryAsStream
<span style="color:purple"><span style="color:black">queryAsStream</span>(sql:<span style="color:orange">string</span>, params?:<span style="color:orange">any[]|{}</span>, options?:<span style="color:orange">SqlQueryOptions</span>):Promise&lt;<span style="color:orange">any[]</span>&gt;</span>

see [streams](/streams)

### find
<span style="color:purple"><span style="color:black">find</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

<span style="color:purple"><span style="color:black">find</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">QueryOptions & Stream</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

Executes a select-where query.
```js

let playerList = await table.find({id:[1,2,3]});
for (let player of playerList) {
    console.log(player.id); //1..2..3
}

playerList = await table.find({id:[1,2,3]}, {fields:['id', 'name'], limit:3});

```
for more options for [conditions](condition) and [queryOptions](QueryOptions) see those sections.

### findWhere
<span style="color:purple"><span style="color:black">findWhere</span>(where:<span style="color:orange">string</span>,params:<span style="color:orange">any[]|{}</span>,options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">ReadableStream</span>&gt;</span>

<span style="color:purple"><span style="color:black">findWhere</span>(where:<span style="color:orange">string</span>,params:<span style="color:orange">any[]|{}</span>,options?:<span style="color:orange">QueryOptions & Stream</span>):Promise&lt;<span style="color:orange">ReadableStream</span>&gt;</span>

Executes a select-where query with free text where etc. 
```js

let res;

res = await table.where("permissions @&gt; {'admin'} AND name!=username AND id=$1  LIMIT 2", [1]);

res = await table.where("permissions @&gt; {'admin'} AND name!=username AND id=:id LIMIT 2", {id:1});

```

### findAll
<span style="color:purple"><span style="color:black">findAll</span>(options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

<span style="color:purple"><span style="color:black">findAll</span>(options?:<span style="color:orange">QueryOptions & Stream</span>):Promise&lt;<span style="color:orange">ReadableStream</span>&gt;</span>

Returns everything from the table. Same as table.find({})
```js
let res = await table.findAll();
```

### findOne
<span style="color:purple"><span style="color:black">findOne</span>(conditions, options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">T</span>&gt;</span>

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

### findFirst
<span style="color:purple"><span style="color:black">findFirst</span>(conditions, options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">T</span>&gt;</span>

Same as await table.find(condition, {limit:1})
```js
let somebody = await table.findFirst({'score &gt;':9000});
```

### count
<span style="color:purple"><span style="color:black">count</span>(conditions?:<span style="color:orange">{}</span>):Promise&lt;<span style="color:orange">number</span>&gt;<span style="color:orange">

Run a count query
```js
let count = await table.count({id:2});
console.log(count); //most probably 1
```

### findOneFieldOnly
<span style="color:purple"><span style="color:black">findOneFieldOnly</span>(conditions:<span style="color:orange">{}</span>, field:<span style="color:orange">string</span>, options?:<span style="color:orange">QueryOptions</span>):Promise&lt;<span style="color:orange">any</span>&gt;</span>

Returns directly the value of a column/field directly.

```js
let nameOfUser = await table.findOneFieldOnly({id:1}, 'name');
console.log(nameOfUser); //most probably 'Admin'
```

### insert
<span style="color:purple"><span style="color:black">insert</span>(records:<span style="color:orange">T</span>, options:<span style="color:orange">InsertOption</span>): Promise&lt;<span style="color:orange">T</span>&gt;</span>

<span style="color:purple"><span style="color:black">insert</span>(records:<span style="color:orange">T[]</span>, options:<span style="color:orange">InsertOption</span>): Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

You can insert one or multiple records, by default the new record(s) will be returned. This can be prevented if not needed;
```js
let user = await table.insert({username:'anonymous'}); //returns the whole record
console.log(user.id); // generated by postgresql
//or
let userList = await table.insert([{username:'anonymous'},{username:'anonymous2'}], {return:['id']});
console.log(userList[0].id); // generated by postgresql

await table.insert({username:'anonymous2'}, {return:[]}); //returns [{}]

```

### insertAndGet
<span style="color:purple"><span style="color:black">insert</span>(records:<span style="color:orange">T</span>, options:<span style="color:orange">InsertOption & Return</span>): Promise&lt;<span style="color:orange">T</span>&gt;</span>

<span style="color:purple"><span style="color:black">insert</span>(records:<span style="color:orange">T[]</span>, options:<span style="color:orange">InsertOption & Return</span>): Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

You can insert one or multiple records, by default the new record(s) will be returned. This can be prevented if not needed;
```js
let user = await table.insert({username:'anonymous'}); //returns the whole record
console.log(user.id); // generated by postgresql
//or
let userList = await table.insert([{username:'anonymous'},{username:'anonymous2'}], {return:['id']});
console.log(userList[0].id); // generated by postgresql

await table.insert({username:'anonymous2'}, {return:[]}); //returns [{}]

```

### update
<span style="color:purple"><span style="color:black">update</span>(conditions:<span style="color:orange">{}</span>, fields:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption</span>):Promise&lt;<span style="color:orange">number</span>&gt;</span>

Run an update query on the table, returns the number of records changed.
```js
await table.update({},{score:null}); //all record is updated
await table.update({'name ~': '^G'}, {numOfLifes:4}); //all record where name starts with G has the numOfLifes set to 4. It's a G'day!
```

### updateOne
<span style="color:purple"><span style="color:black">updateOne</span>(conditions:<span style="color:orange">{}</span>, fields:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption</span>): Promise&lt;<span style="color:orange">number</span>&gt;</span>

Run an update query, throws exception if more then one record has been updated. (Handy if you roll back on exception)
```js
await table.updateOne({id:1},{password:null});
await table.updateOne({notUniqId:1},{password:null}); //throws exception if more then 1 rec has been updated;
```

### updateAndGet
<span style="color:purple"><span style="color:black">updateAndGet</span>(conditions:<span style="color:orange">{}</span>, fields:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption & Return</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

Run an update query on the table
```js
let playerList = await table.updateAndGet({'score &gt;': '9000'}, {achivement:"It's Over 9000!"}); 
//update the achievement fields for all players where the score is over 9000 then returns the updated list

let playerIdList = await table.updateAndGet({'score &gt;': '9000'}, {achivement:"It's Over 9000!"}, {return:['id']});
```

### updateAndGetOne
<span style="color:purple"><span style="color:black">updateAndGetOne</span>(conditions:<span style="color:orange">{}</span>, fields:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption & Return</span>): Promise&lt;<span style="color:orange">T</span>&gt;</span>

Run an update query and returns with the updated record, 
throws exception if more then one record has been updated. (Handy if you roll back on exception)
```js
let user = await table.updateOne({id:1},{password:null});
console.log(user.name); //the whole record is returned
```

### delete
<span style="color:purple"><span style="color:black">delete</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption</span>):Promise&lt;<span style="color:orange">number</span>&gt;</span>

Executes a delete-where query.

```js
let numberOfRowsDeleted = await table.delete({id:[1,2,3]});
if (numberOfRowsDeleted!=3) {
    //alarm!!
}
```

### deleteOne
<span style="color:purple"><span style="color:black">deleteOne</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption</span>):Promise&lt;<span style="color:orange">number</span>&gt;</span>

Executes a delete-where query, but throws exception if more then one record is deleted;
```js
let numberOfDeleted = await table.deleteOne({id:[1,2,3]}); //throws exception if more then one record is deleted
console.log(numberOfDeleted); //0 or 1
```

### deleteAndGet
<span style="color:purple"><span style="color:black">deleteAndGet</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption & Return</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

Executes a delete-where query and returns with the deleted records;
```js
let playersDeleted = await table.deleteAndGet({id:[1,2,3]});
for (let player of playersDeleted) {
    console.log(player.id); //1 then 2 then 3
}
```

### deleteAndGetOne
<span style="color:purple"><span style="color:black">deleteAndGetOne</span>(conditions:<span style="color:orange">{}</span>, options?:<span style="color:orange">UpdateDeleteOption & Return</span>):Promise&lt;<span style="color:orange">T[]</span>&gt;</span>

Executes a delete-where query, but throws exception if more then one record is deleted;
Returns with the deleted record if any.
```js
let playerDeleted = await table.deleteAndGet({id:[1,2,3]});  //throws exception if more then one record is deleted
console.log(player.id); //Either 1, 2, 3 or null if no record is deleted

```







