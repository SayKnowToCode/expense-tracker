"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = void 0;
const papaparse_1 = __importDefault(require("papaparse"));
const parseCsv = (csvString, columnMapping) => {
    const { data } = papaparse_1.default.parse(csvString, { header: true, skipEmptyLines: true });
    // Map columns
    return data.map(row => {
        const mapped = {};
        for (const [csvCol, field] of Object.entries(columnMapping)) {
            mapped[field] = row[csvCol];
        }
        mapped.rawCsvJson = row;
        return mapped;
    });
};
exports.parseCsv = parseCsv;
