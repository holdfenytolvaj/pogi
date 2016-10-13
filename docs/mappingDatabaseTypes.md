##Type conversion

By default all field returned as a string from postgre. Pg.js convert some of it, e.g. dates
 to js types, pgdb will convert a bit more e.g. dates arrays, number arrays, bigInts,   
 
### The simplest way 

```ts
    var numWithValidation = val => {
        let v = +val;
        if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
            throw Error("Number can't be represented in javascript precisely: " + val);
        }
        return v;
    };

    await pgdb.setTypeParser('int8', numWithValidation, 'myschema'); 
    //leaving out 'myschema' would apply to all schemas
   
```

### Looks simple, but...
pg.js doesn't handle well the exception during type conversion. 
If exception is thrown the node process will exit. So you can add your converter
to pgdb layer if exception is possible.

```ts
    await pgdb.setPgDbTypeParser('int8', numWithValidation); 
```

### complex types and complex type arrays
Complex type looks promising instead of link tables, but unfortunately 
they do not have to foreign key check at the moment in PostgreSQL(9.6). 
Also right now we didn't put much effort to this feature, we rather use jsonb columns instead. 
But it would be relative easy to add support for them to save and read as js objects (and might be support the operators).

####Example complex type:
```sql
    CREATE TYPE "permissionType" AS ENUM ('read', 'write', 'admin');
    CREATE TYPE "permissionForResourceType" AS (
        "permission"    "permissionType",
        "resource"      "text"
    );
```

####Add parsing to list:
```js
function parseComplexType(str) {
    //cut of '(', ')'
    str = str.substring(1, str.length-1);
    let e = /"((?:[^"]|"")*)"(?:,|$)|([^,]*)(?:,|$)/g;
    let valList = [];
    let parsingResult;
    let valStr;
    let hasNextValue;
    /**
     * parsingResult.index<str.length check for finish is not reliable
     * as if the last value is null it goes undetected, e.g. (,,)
     */
    do {
        parsingResult = e.exec(str);
        valStr = (parsingResult[0]=='' || parsingResult[0]==',' || parsingResult[2]=='null') ? null : parsingResult[1] || parsingResult[2] ;
        if (parsingResult[0]=='"",' || parsingResult[0]=='""') {
            valStr = '';
        }
        valList.push(valStr ? valStr.replace(/""/g,'"') : valStr);
        hasNextValue = parsingResult[0].substring(parsingResult[0].length-1,parsingResult[0].length)==',';
    } while (hasNextValue);
    return valList;
}

await pgdb.setTypeParser('permissionForResourceType', parseComplexType, 'myschema'); 

```

####Add parsing for array:
```js
function parseComplexTypeArray(str) {
    let list = JSON.parse('[' + str.substring(1, str.length - 1) + ']');

    let result = [];
    for (let elementStr of list) {
        result.push(parseComplexType(elementStr));
    }
    return result;
}

await pgdb.setTypeParser('_permissionForResourceType', parseComplexTypeArray, 'myschema');
```
