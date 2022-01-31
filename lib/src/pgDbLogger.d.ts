export interface PgDbLogger {
    log: Function;
    error: Function;
    paramSanitizer?: Function;
}
