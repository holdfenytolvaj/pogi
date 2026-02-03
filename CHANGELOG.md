## [3.0.2](https://github.com/holdfenytolvaj/pogi/compare/v2.10.2...v3.0.2) (2026-02-03)


### Bug Fixes

* emitter leak ([3040a43](https://github.com/holdfenytolvaj/pogi/commit/3040a43c2cd6a8fee319f6dfe4cb66b7693e4443))
* oid fix ([bfaedd5](https://github.com/holdfenytolvaj/pogi/commit/bfaedd5a10810623d27be010e338abe324155494))
* oid fixes ([5af7146](https://github.com/holdfenytolvaj/pogi/commit/5af7146d727f0344e3411a2f9df1f02afbf998b2))
* orderBy ([33f2373](https://github.com/holdfenytolvaj/pogi/commit/33f23730a51c5c921c1e2f725ee1202b84138072))
* strict column escape ([e4eeff3](https://github.com/holdfenytolvaj/pogi/commit/e4eeff3558ccc3b0cd02875b46a95f19feb8781a))
* support node v24 ([234e44a](https://github.com/holdfenytolvaj/pogi/commit/234e44ac268213fc668913a3184be211d4f6d2b6))
* ts warnings ([a16231c](https://github.com/holdfenytolvaj/pogi/commit/a16231c5c1e5053d9c2cf4ef86a81990cc7963f4))
* typescript errors, build ([ac4210a](https://github.com/holdfenytolvaj/pogi/commit/ac4210a412717141151d0a1a870d3f23d0d450e8))
* wrongly implemented catch for non-transactional query ([f79de17](https://github.com/holdfenytolvaj/pogi/commit/f79de17a781e2d6c7873b4afc88eacbd020c836b))


### Features

* improve  sql injections prevention phase 2 ([880b9c4](https://github.com/holdfenytolvaj/pogi/commit/880b9c4b26b107b7bb3d2caae24319c761f95a4c))
* strictDDL for group by/order by/limit/offset ([54c866f](https://github.com/holdfenytolvaj/pogi/commit/54c866f1fcec9f1b8666c0a8a509663acc0af79c))



# [2.11.0](https://github.com/holdfenytolvaj/pogi/compare/v2.10.0...v2.11.0) (2021-09-16)

### Features

- documentation on postgres-notifications
([427119b](https://github.com/holdfenytolvaj/pogi/commit/427119baa3ffd8a19dc5ba5084e08ab7e2a4c395))
- automatic restart upon disconnected connection ([2bc777a](https://github.com/holdfenytolvaj/pogi/commit/2bc777ace4b88c2890b80e4090f3733137b89ef5))
- automatic recognition of changed enum ([5af7146](https://github.com/holdfenytolvaj/pogi/commit/5af7146d727f0344e3411a2f9df1f02afbf998b2),[bfaedd5](https://github.com/holdfenytolvaj/pogi/commit/bfaedd5a10810623d27be010e338abe324155494))

### Bug Fixes

## [2.10.2](https://github.com/holdfenytolvaj/pogi/compare/v2.10.0...v2.10.2) (2021-01-29)


### Bug Fixes

* Null pointer exception ([289e6f4](https://github.com/holdfenytolvaj/pogi/commit/289e6f4))



## [2.10.1](https://github.com/holdfenytolvaj/pogi/compare/v2.10.0...v2.10.1) (2021-01-29)


### Bug Fixes

* Null pointer exception ([289e6f4](https://github.com/holdfenytolvaj/pogi/commit/289e6f4))



# [2.10.0](https://github.com/holdfenytolvaj/pogi/compare/v2.9.2...v2.10.0) (2021-01-29)


### Features

* new query function queryAsRows which gives result as array instead of objects ([119aa73](https://github.com/holdfenytolvaj/pogi/commit/119aa73))



# [2.10.0](https://github.com/holdfenytolvaj/pogi/compare/v2.9.2...v2.10.0) (2021-01-29)


### Features

* new query function queryAsRows which gives result as array instead of objects ([119aa73](https://github.com/holdfenytolvaj/pogi/commit/119aa73))



## [2.9.2](https://github.com/holdfenytolvaj/pogi/compare/v2.9.1...v2.9.2) (2020-06-13)

### Bug Fixes

* handle empty 'and' and 'or' condition ([e49c416](https://github.com/holdfenytolvaj/pogi/commit/e49c416))

## [2.9.1](https://github.com/holdfenytolvaj/pogi/compare/v2.9.0...v2.9.1) (2020-06-13)

### Chore
bump pg (8.2.1) and pg-query-stream (3.1.1) to support nodejs v14


# [2.9.0](https://github.com/holdfenytolvaj/pogi/compare/v2.8.0...v2.9.0) (2020-05-28)

### Features

* more options to handle transaction,  savepoint support from API ([d5a88cb](https://github.com/holdfenytolvaj/pogi/commit/d5a88cb))


# [2.8.0](https://github.com/holdfenytolvaj/pogi/compare/v2.5.11...v2.8.0) (2020-04-29)


### Bug Fixes

* execute (file) function do not start new dedicated connection when run in one, add support for /* */ comment ([d5a03d5](https://github.com/holdfenytolvaj/pogi/commit/d5a03d5))


### Features

* add notify and listen functions ([fb3318a](https://github.com/holdfenytolvaj/pogi/commit/fb3318a))



<a name="2.7.2"></a>
## add initial support for postgresl PUB/SUB

<a name="2.7.1"></a>
## add more test and update packages

[.. some missing update]

<a name="2.5.11"></a>
## [2.5.11](https://github.com/holdfenytolvaj/pogi/compare/v2.5.10...v2.5.11) (2018-10-01)


### Bug Fixes

* queryOneField and queryOneColumn maybe fall if no result found ([3395951](https://github.com/holdfenytolvaj/pogi/commit/3395951))



<a name="2.5.10"></a>
## [2.5.10](https://github.com/holdfenytolvaj/pogi/compare/v2.5.9...v2.5.10) (2018-08-14)
 * use different syntax for array query to avoid long sql (so instead of "field IN ($1, $2, $3)" where $1 $2 $3 are values use "field =ANY $1" where $1 is an array). There is no speed difference


<a name="2.5.8"></a>
## [2.5.8](https://github.com/holdfenytolvaj/pogi/compare/v2.5.6...v2.5.8) (2018-04-23)
* Nothing changed, just scripts runs and runs


<a name="2.5.7"></a>
## [2.5.7](https://github.com/holdfenytolvaj/pogi/compare/v2.5.6...v2.5.7) (2018-04-23)

### Bug Fixes

* null item value handling on column type number[]


<a name="2.5.6"></a>
## [2.5.6](https://github.com/holdfenytolvaj/pogi/compare/v2.5.5...v2.5.6) (2018-03-05)


### Bug Fixes

* reload function should use transaction if it started to reload schema. ([d14c495](https://github.com/holdfenytolvaj/pogi/commit/d14c495))



<a name="2.5.5"></a>
## [2.5.5](https://github.com/holdfenytolvaj/pogi/compare/v2.5.3...v2.5.5) (2017-12-12)
* Nothing changed, just scripts runs and runs

## [2.5.4](https://github.com/holdfenytolvaj/pogi/compare/v2.5.3...v2.5.5) (2017-12-12)
### Bug Fixes
* fix import statement

<a name="2.5.3"></a>
## [2.5.3](https://github.com/holdfenytolvaj/pogi/compare/v2.5.2...v2.5.3) (2017-12-04)


### Bug Fixes

* array column parsing , JSON.parse do not handle correctly special characters ex: \ f (formfeed) ([c2a48dc](https://github.com/holdfenytolvaj/pogi/commit/c2a48dc))



<a name="2.5.2"></a>
## [2.5.2](https://github.com/holdfenytolvaj/pogi/compare/v2.5.1...v2.5.2) (2017-11-30)


### Bug Fixes

* update query build did not handle properly null value on query ([0d84e61](https://github.com/holdfenytolvaj/pogi/commit/0d84e61))



<a name="2.5.1"></a>
## [2.5.1](https://github.com/holdfenytolvaj/pogi/compare/v2.5.0...v2.5.1) (2017-11-08)
* Nothing changed, just scripts runs and runs


<a name="2.5.0"></a>
# [2.5.0](https://github.com/holdfenytolvaj/pogi/compare/v2.4.0...v2.5.0) (2017-11-08)


### Bug Fixes

* add tslib to dependencies ([eb16ea4](https://github.com/holdfenytolvaj/pogi/commit/eb16ea4))
* jsonb[] column parsing ([eafb0fd](https://github.com/holdfenytolvaj/pogi/commit/eafb0fd))



<a name="2.4.0"></a>
# [2.4.0](https://github.com/holdfenytolvaj/pogi/compare/v2.3.5...v2.4.0) (2017-10-24)


### Features

* add queryFirst, queryOne queries which return only one result ([dce7bad](https://github.com/holdfenytolvaj/pogi/commit/dce7bad))
* add distinct, forUpdate as boolean query options ([dce7bad](https://github.com/holdfenytolvaj/pogi/commit/dce7bad))



<a name="2.3.5"></a>
## [2.3.5](https://github.com/holdfenytolvaj/pogi/compare/v2.3.4...v2.3.5) (2017-10-20)


### Bug Fixes

* option is passed to pg connect by a copied  object not prototype ([7c5e186](https://github.com/holdfenytolvaj/pogi/commit/7c5e186))



<a name="2.3.4"></a>
## [2.3.4](https://github.com/holdfenytolvaj/pogi/compare/v2.3.3...v2.3.4) (2017-10-19)


### Bug Fixes

* streams not released connections ([a7fdb42](https://github.com/holdfenytolvaj/pogi/commit/a7fdb42))
* textArray parsing do not handle right "  character ([c3993db](https://github.com/holdfenytolvaj/pogi/commit/c3993db))



<a name="2.3.3"></a>
## [2.3.3](https://github.com/holdfenytolvaj/pogi/compare/v2.3.2...v2.3.3) (2017-10-13)


### Bug Fixes

* pg stream not working with newer version of pg-query-stream ([00d1687](https://github.com/holdfenytolvaj/pogi/commit/00d1687))



<a name="2.3.2"></a>
## [2.3.2](https://github.com/holdfenytolvaj/pogi/compare/v2.2.4...v2.3.2) (2017-09-29)


### Bug Fixes

* textArray parsing do not handle right \ escape character ([7b9c332](https://github.com/holdfenytolvaj/pogi/commit/7b9c332))



<a name="2.2.4"></a>
## [2.2.4](https://github.com/holdfenytolvaj/pogi/compare/v2.2.3...v2.2.4) (2017-06-11)



<a name="2.2.3"></a>
## [2.2.3](https://github.com/holdfenytolvaj/pogi/compare/v2.2.2...v2.2.3) (2017-06-06)



<a name="2.2.2"></a>
## [2.2.2](https://github.com/holdfenytolvaj/pogi/compare/v2.2.1...v2.2.2) (2017-06-02)



<a name="2.2.1"></a>
## [2.2.1](https://github.com/holdfenytolvaj/pogi/compare/v2.2.0...v2.2.1) (2017-03-20)



<a name="2.2.0"></a>
# [2.2.0](https://github.com/holdfenytolvaj/pogi/compare/v2.1.1...v2.2.0) (2017-03-18)



<a name="2.1.1"></a>
## [2.1.1](https://github.com/holdfenytolvaj/pogi/compare/v2.1.0...v2.1.1) (2017-03-13)



<a name="2.1.0"></a>
# [2.1.0](https://github.com/holdfenytolvaj/pogi/compare/v2.0.0...v2.1.0) (2017-01-23)



<a name="2.0.0"></a>
# [2.0.0](https://github.com/holdfenytolvaj/pogi/compare/v1.0.4...v2.0.0) (2016-12-12)



<a name="1.0.2"></a>
## [1.0.2](https://github.com/holdfenytolvaj/pogi/compare/v1.0.1...v1.0.2) (2016-11-30)



<a name="1.0.1"></a>
## [1.0.1](https://github.com/holdfenytolvaj/pogi/compare/v1.0.0...v1.0.1) (2016-10-13)



<a name="1.0.0"></a>
# 1.0.0 (2016-10-12)



