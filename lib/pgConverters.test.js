"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pgConverters_1 = require("./pgConverters");
describe("pgConverters.test", () => {
    it("parseArray", () => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
        expect(pgConverters_1.parseArray('{}')).toEqual([]);
        expect(pgConverters_1.parseArray('{1,2}')).toEqual(['1', '2']);
        expect(pgConverters_1.parseArray('{NULL,""}')).toEqual([null, '']);
        expect(pgConverters_1.parseArray('{"\\\\","\\""}')).toEqual(['\\', '"']);
    }));
});
//# sourceMappingURL=pgConverters.test.js.map