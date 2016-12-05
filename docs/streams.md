#Example

##Using queryAsStream
```ts

let stream = await pgdb.queryAsStream(`SELECT * FROM generate_series(0, 1001) num`);

stream.on('data', (c: any)=> {
    //do or not do stuff
});

await new Promise((resolve, reject)=> {
    stream.on('end', resolve);
    stream.on('error', reject);
});

```

##Using find

find/findAll/findWhere all can be used to return a stream, passing it to the options.

```ts

let stream;
stream = await pgdb.users.find({'id >':1}, {stream:true});
stream = await pgdb.users.findAll({stream:true});
stream = await pgdb.users.findWhere('true', null, {stream:true});


```

##Using async in stream
```ts
let stream = await pgdb.users.find({'id >':1}, {stream:true});
stream.on('data', (user: User)=> {
    stream.pause();
    
    (async function() {
        ...
        await mightDoSth(user);
        ...        
        stream.resume();
    })().catch(e=>{
        console.error(e);
        stream.emit( "error", e);
    });
});

await new Promise((resolve, reject)=> {
    stream.on('end', resolve);
    stream.on('error', reject);
});
```
