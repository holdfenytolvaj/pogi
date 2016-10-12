#Using stored procedures
When loading PgDb, stored procedures/functions will be loaded as well to the `fn` namespace for schemas. Like this function
```SQL
CREATE OR REPLACE FUNCTION increment(i INT)
RETURNS INT AS $$
BEGIN
  RETURN i + 1;
END;
$$ LANGUAGE plpgsql;
```
could be used as easy as this
```js
    var num = pgdb.fn.increment(4)
```
It will detect return values, and if it is a single value or an array of single values it will resolve result row(s) for you
