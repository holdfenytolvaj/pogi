##Conditions and operators

Basic examples:

| Condition     | SQL                      
| ------------- |:-------------- 
| {id: 2}        | "id" = 2  
| {'id <': 2}    | "id" < 2      
| {'id >': 2}    | "id" > 2
| {'id <=': 2}   | "id" <= 2      
| {'id >=': 2}   | "id" >= 2
| {'id !=': 2}   | "id" != 2
| {'id <>': 2}   | "id" != 2
| {'id': null}   | "id" is null
| {'id !=': null}| "id" is not null
| {'id is not': null}| "id" is not null

Extended:

| Condition        | SQL                      
| -------------    |:-------------- 
| {id:[1,2,3]}     | "id" in (1,2,3)
| {'id in':[1,2,3]}| "id" in (1,2,3)
| {'id not in':[1,2,3]}| "id" not in (1,2,3)
| {'id <>':[1,2,3]}| "id" not in (1,2,3) 
| {'id =*':'gamma'}| LOWER("id") = LOWER('gamma')

Pattern matching:
[PostgreSQL Documentation](https://www.postgresql.org/docs/9.6/static/functions-matching.html)

| Condition        | SQL                      
| -------------    |:-------------- 
| {'id ~~': 'a%'} | "id" LIKE 'a%'
| {'id !~~': 'a%'} | "id" NOT LIKE 'a%'
| {'id like': 'a%'} | "id" LIKE 'a%'
| {'id not like': 'a%'} | "id" NOT LIKE 'a%'
| {'id ~~*': 'a%'} | "id" ILIKE 'a%'
| {'id !~~*': 'a%'} | "id" NOT ILIKE 'a%'
| {'id ilike': 'a%'} | "id" ILIKE 'a%'
| {'id not ilike': 'a%'} | "id" NOT ILIKE 'a%'
| {'id similar to': 'a%'} | "id" SIMILAR TO 'a%'
| {'id not similar to': 'a%'} | "id" NOT SIMILAR TO 'a%'
| {'id ~': '^a'} | "id" ~ '^a'
| {'id !~': '^a'} | "id" !~ '^a'
| {'id ~*': '^a'}| "id" ~* '^a'
| {'id !~*': '^a'}| "id" !~* '^a'
| {'id is distinct from': '^a'}| "id" IS DISTINCT FROM '^a'
| {'id is not distinct from': '^a'}| "id" IS NOT DISTINCT FROM '^a'

##Array type 
[PostgreSQL Documentation](https://www.postgresql.org/docs/current/static/functions-array.html)

| Condition          | SQL                      
| -------------      |:-------------- 
| {'ids @>':[1,2,3]} | "ids" @> '{1,2,3}'       
| {'ids <@':[1,2,3]} | "ids" <@ '{1,2,3}'
| {'ids &&':[1,2,3]} | "ids" && '{1,2,3}'
| {'ids': [1,2,3]}   | "ids" = '{1,2,3}'
| {'ids': 'a'}       | 'a' = ANY("ids")
| {'ids <>': 'a'}    | 'a' <> ANY("ids")
| {'ids ~': 'a%'}    | EXISTS (SELECT * FROM (SELECT UNNEST("ids") _el) _arr WHERE _arr._el ~ 'a%')'; //same with all pattern


##Jsonb type
[PostgreSQL Documentation](https://www.postgresql.org/docs/current/static/functions-json.html)

| Condition         | SQL                      
| -------------     |:-------------- 
| {'id @>':[1,2,3]} | "id" @> '[1,2,3]'
| {'id @>':{a:1}}   | "id" @> '{a:1}'
| {'id <@':[1,2,3]} | "id" <@ '[1,2,3]'
| {'id <@':{a:1}}   | "id" <@ '{a:1}'
| {'id ?':'a'}      | "id" ? 'a'
| {'id ?&#124;':['a','b']}| "id" ?&#124; '{a,b}'
| {'id ?&':['a','b']}| "id" ?& '{a,b}'
| {'id --> a':3| "id"-->'a' = 3
| {'id --> 3':3| "id"-->3 = 3 //if the field is a number, the quote wont apply as it can refer index ... 
| {"id --> '3'":3| "id"-->'3' = 3 //... so you have to apply that manually


## OR - AND
condition-expressions can be joined together e.g.:

| Condition                | SQL                      
| -------------            |:-------------- 
| {id:1, name:'a'}         | id=1 AND name='a'
| {or:[{id:1},{name:'a'}]} | id=1 OR  name='a'
| {and:[or:[{id:1},{'port >':'1024'}],or:[{host:'localhost', os:'linux'},{host:'127.0.0.1'}]]} | (.. OR ..) AND ((.. AND ..) OR ..)









