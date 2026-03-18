"use strict";
/**
 * Build-time script: downloads OpenFlights airports.dat and emits
 * public/data/airports.json — a filtered, minimal JSON asset.
 *
 * Run once: npx ts-node scripts/fetch-airports.ts
 * Output is committed to the repo — no runtime dependency on OpenFlights.
 *
 * CSV columns (index):
 *  0  Airport ID (internal)
 *  1  Name
 *  2  City
 *  3  Country
 *  4  IATA (3-letter, or "\N" if unassigned)
 *  5  ICAO (4-letter)
 *  6  Latitude
 *  7  Longitude
 *  8  Altitude
 *  9  Timezone
 *  10 DST
 *  11 Tz database timezone
 *  12 Type (airport | station | port | unknown)
 *  13 Source
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var https_1 = __importDefault(require("https"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var SOURCE_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";
var OUT_DIR = path_1.default.resolve(process.cwd(), "public", "data");
var OUT_FILE = path_1.default.join(OUT_DIR, "airports.json");
function parseCsvLine(line) {
    var result = [];
    var inQuote = false;
    var current = "";
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            inQuote = !inQuote;
        }
        else if (ch === "," && !inQuote) {
            result.push(current);
            current = "";
        }
        else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}
function fetchText(url) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    https_1.default.get(url, function (res) {
                        if (res.statusCode !== 200) {
                            reject(new Error("HTTP ".concat(res.statusCode, " fetching ").concat(url)));
                            return;
                        }
                        var data = "";
                        res.on("data", function (chunk) { data += chunk.toString(); });
                        res.on("end", function () { return resolve(data); });
                        res.on("error", reject);
                    }).on("error", reject);
                })];
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var raw, lines, airports, _i, lines_1, line, cols, iata, type;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Fetching airports.dat from OpenFlights...");
                    return [4 /*yield*/, fetchText(SOURCE_URL)];
                case 1:
                    raw = _a.sent();
                    console.log("Fetched successfly...");
                    lines = raw.split("\n").filter(function (l) { return l.trim().length > 0; });
                    airports = [];
                    for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        line = lines_1[_i];
                        cols = parseCsvLine(line);
                        if (cols.length < 14)
                            continue;
                        iata = cols[4];
                        type = cols[12];
                        // Skip rows with no IATA code or non-airport types
                        if (!iata || iata === "\\N" || iata === "")
                            continue;
                        if (type !== "airport")
                            continue;
                        console.log("Done parsing... now pushing");
                        airports.push({
                            iata: iata.trim(),
                            name: cols[1].trim(),
                            city: cols[2].trim(),
                            country: cols[3].trim(),
                        });
                    }
                    fs_1.default.mkdirSync(OUT_DIR, { recursive: true });
                    fs_1.default.writeFileSync(OUT_FILE, JSON.stringify(airports), "utf8");
                    console.log("Done. ".concat(airports.length, " airports written to ").concat(OUT_FILE));
                    console.log("File size: ".concat((fs_1.default.statSync(OUT_FILE).size / 1024).toFixed(1), " KB"));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
