/**
 * log will get 3 parameters:
 *    sql -> the query
 *    parameters -> parameters for the query
 *    poolId -> the id of the connection
 * 
 * paramSanitizer - optional function to remove parameters from the query for security reason (e.g. email / password or similar)
 */
export interface PgDbLogger {
    log: Function;
    error: Function;
    paramSanitizer?: Function;
}
