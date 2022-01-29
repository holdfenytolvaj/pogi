import * as pg from 'pg';

declare module 'pg' {
    export interface PoolClient {
        processID: string,
    }
}