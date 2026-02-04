import { parseArray } from "./pgConverters.js";
describe("pgConverters.test", () => {
    it("parseArray", async () => {
        expect(parseArray('{}')).toEqual([]);
        expect(parseArray('{1,2}')).toEqual(['1', '2']);
        expect(parseArray('{NULL,""}')).toEqual([null, '']);
        expect(parseArray('{"\\\\","\\""}')).toEqual(['\\', '"']);
    });
});
//# sourceMappingURL=pgConverters.test.js.map