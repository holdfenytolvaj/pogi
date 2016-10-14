##Does it support prepared statements?
At the moment not, we can add it, but according to 
[this](https://github.com/brianc/node-postgres/wiki/Parameterized-queries-and-Prepared-Statements)
they do not add big values.

##What is pogi?
**pgdb** name was taken, so we renamed it to **pogi**. Pogi is the nickname of a delicious pastry. Yam!
Search for 'pogacsa'.

##Is there any company behind it?
It was originally developed at [www.labcup.net](http://www.labcup.net/), where we also use it. 

##My IDE don't show pogi's typing definitions
Typescript should get it from npm, but maybe this help:
`typings install pogi=github:holdfenytolvaj/pogi/lib/index.d.ts --save`
