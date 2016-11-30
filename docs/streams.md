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
stream = await pgdb.find({'id >':1}, {stream:true});
stream = await pgdb.findAll({stream:true});
stream = await pgdb.findWhere('true', null, {stream:true});


```
