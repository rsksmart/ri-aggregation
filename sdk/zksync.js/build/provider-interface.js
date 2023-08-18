"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncProvider = void 0;
const utils_1 = require("./utils");
class SyncProvider {
    constructor() {
        // For HTTP provider
        this.pollIntervalMilliSecs = 1000;
    }
    updateTokenSet() {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedTokenSet = new utils_1.TokenSet(yield this.getTokens());
            this.tokenSet = updatedTokenSet;
        });
    }
    getTokenSymbol(token) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, utils_1.isNFT)(token)) {
                const nft = yield this.getNFT(token);
                return nft.symbol || `NFT-${token}`;
            }
            return this.tokenSet.resolveTokenSymbol(token);
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}
exports.SyncProvider = SyncProvider;
