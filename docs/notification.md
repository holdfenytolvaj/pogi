## Notification
as simple as:
```js
    let result = '';
    await db.listen('channel', (data) => { result += data.payload; });
    await db.listen('channel', () => { result += ',nextCallback'; });

    await db.run(`NOTIFY channel, 'data'`);
    //same as: await db.notify('channel', 'data');
    //result will be: 'data,nextCallback'

    await db.unlisten('channel'); 
    //dedicated listener connection now released.
```

See [Postgresql documentation](https://www.postgresql.org/docs/current/sql-notify.html)

## Some comments
Notification listeners uses a dedicated connection. If e.g. the postgresql server restarts, some notifications might not be received, but the connection and the listeners will be re-created.
