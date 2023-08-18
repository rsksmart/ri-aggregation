"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.l1ChainId = void 0;
const MAINNET_NETWORK_CHAIN_ID = 30;
const TESTNET_NETWORK_CHAIN_ID = 31;
const LOCALHOST_NETWORK_CHAIN_ID = 33;
function l1ChainId(network) {
    if (network === 'mainnet') {
        return MAINNET_NETWORK_CHAIN_ID;
    }
    if (network === 'testnet') {
        return TESTNET_NETWORK_CHAIN_ID;
    }
    if (network === 'localhost') {
        return LOCALHOST_NETWORK_CHAIN_ID;
    }
    throw new Error('Unsupported network');
}
exports.l1ChainId = l1ChainId;
