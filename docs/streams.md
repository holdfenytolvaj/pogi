
##Example

```ts

let stream = await pgdb.queryAsStream(`SELECT * FROM generate_series(0, 1001) num`);

stream.on('data', (c: any)=> {
    //do or do not stuff
});

await new Promise((resolve, reject)=> {
    stream.on('end', resolve);
    stream.on('error', reject);
});

```
