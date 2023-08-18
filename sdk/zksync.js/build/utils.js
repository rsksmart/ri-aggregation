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
exports.serializeTimestamp = exports.serializeNonce = exports.serializeFeePacked = exports.serializeAmountFull = exports.serializeAmountPacked = exports.serializeTokenId = exports.serializeAccountId = exports.serializeAddress = exports.serializeContentHash = exports.getEthSignatureType = exports.verifyERC1271Signature = exports.signMessagePersonalAPI = exports.getSignedBytesFromMessage = exports.getToggle2FAMessage = exports.getChangePubkeyLegacyMessage = exports.getChangePubkeyMessage = exports.TokenSet = exports.isTokenRBTC = exports.sleep = exports.buffer2bitsBE = exports.isNFT = exports.isTransactionFeePackable = exports.closestGreaterOrEqPackableTransactionFee = exports.closestPackableTransactionFee = exports.isTransactionAmountPackable = exports.closestGreaterOrEqPackableTransactionAmount = exports.closestPackableTransactionAmount = exports.packFeeChecked = exports.packAmountChecked = exports.reverseBits = exports.integerToFloatUp = exports.integerToFloat = exports.bitsIntoBytesInBEOrder = exports.floatToInteger = exports.weiRatio = exports.tokenRatio = exports.ERC20_RECOMMENDED_DEPOSIT_GAS_LIMIT = exports.RBTC_RECOMMENDED_DEPOSIT_GAS_LIMIT = exports.ERC20_APPROVE_TRESHOLD = exports.MAX_ERC20_APPROVE_AMOUNT = exports.ERC20_DEPOSIT_GAS_LIMIT = exports.MULTICALL_INTERFACE = exports.IEIP1271_INTERFACE = exports.SYNC_NFT_FACTORY_INTERFACE = exports.SYNC_GOV_CONTRACT_INTERFACE = exports.SYNC_MAIN_CONTRACT_INTERFACE = exports.IERC20_INTERFACE = exports.CURRENT_TX_VERSION = exports.MIN_NFT_TOKEN_ID = exports.MAX_TIMESTAMP = void 0;
exports.getTxHash = exports.getPendingBalance = exports.getEthereumBalance = exports.getCREATE2AddressAndSalt = exports.parseHexWithPrefix = exports.numberToBytesBE = exports.serializeTx = exports.serializeForcedExit = exports.serializeChangePubKey = exports.serializeTransfer = exports.serializeWithdrawNFT = exports.serializeMintNFT = exports.serializeWithdraw = exports.serializeSwap = exports.serializeOrder = void 0;
const ethers_1 = require("ethers");
const crypto_1 = require("./crypto");
// Max number of tokens for the current version, it is determined by the Rollup circuit implementation.
const MAX_NUMBER_OF_TOKENS = Math.pow(2, 31);
// Max number of accounts for the current version, it is determined by the Rollup circuit implementation.
const MAX_NUMBER_OF_ACCOUNTS = Math.pow(2, 24);
exports.MAX_TIMESTAMP = 4294967295;
exports.MIN_NFT_TOKEN_ID = 65536;
exports.CURRENT_TX_VERSION = 1;
exports.IERC20_INTERFACE = new ethers_1.utils.Interface(require('../abi/IERC20.json').abi);
exports.SYNC_MAIN_CONTRACT_INTERFACE = new ethers_1.utils.Interface(require('../abi/SyncMain.json').abi);
exports.SYNC_GOV_CONTRACT_INTERFACE = new ethers_1.utils.Interface(require('../abi/SyncGov.json').abi);
exports.SYNC_NFT_FACTORY_INTERFACE = new ethers_1.utils.Interface(require('../abi/NFTFactory.json').abi);
exports.IEIP1271_INTERFACE = new ethers_1.utils.Interface(require('../abi/IEIP1271.json').abi);
exports.MULTICALL_INTERFACE = new ethers_1.utils.Interface(require('../abi/Multicall.json').abi);
exports.ERC20_DEPOSIT_GAS_LIMIT = require('../misc/DepositERC20GasLimit.json');
exports.MAX_ERC20_APPROVE_AMOUNT = ethers_1.BigNumber.from('115792089237316195423570985008687907853269984665640564039457584007913129639935'); // 2^256 - 1
exports.ERC20_APPROVE_TRESHOLD = ethers_1.BigNumber.from('57896044618658097711785492504343953926634992332820282019728792003956564819968'); // 2^255
// Gas limit that is set for rbtc deposit by default. For default EOA accounts 60k should be enough, but we reserve
// more gas for smart-contract wallets
exports.RBTC_RECOMMENDED_DEPOSIT_GAS_LIMIT = ethers_1.BigNumber.from('90000'); // 90k
// For normal wallet/erc20 token 90k gas for deposit should be enough, but for some tokens this can go as high as ~200k
// we try to be safe by default
exports.ERC20_RECOMMENDED_DEPOSIT_GAS_LIMIT = ethers_1.BigNumber.from('300000'); // 300k
const AMOUNT_EXPONENT_BIT_WIDTH = 5;
const AMOUNT_MANTISSA_BIT_WIDTH = 35;
const FEE_EXPONENT_BIT_WIDTH = 5;
const FEE_MANTISSA_BIT_WIDTH = 11;
function tokenRatio(ratio) {
    return Object.assign({ type: 'Token' }, ratio);
}
exports.tokenRatio = tokenRatio;
function weiRatio(ratio) {
    return Object.assign({ type: 'Wei' }, ratio);
}
exports.weiRatio = weiRatio;
function floatToInteger(floatBytes, expBits, mantissaBits, expBaseNumber) {
    if (floatBytes.length * 8 !== mantissaBits + expBits) {
        throw new Error('Float unpacking, incorrect input length');
    }
    const bits = buffer2bitsBE(floatBytes).reverse();
    let exponent = ethers_1.BigNumber.from(0);
    let expPow2 = ethers_1.BigNumber.from(1);
    for (let i = 0; i < expBits; i++) {
        if (bits[i] === 1) {
            exponent = exponent.add(expPow2);
        }
        expPow2 = expPow2.mul(2);
    }
    exponent = ethers_1.BigNumber.from(expBaseNumber).pow(exponent);
    let mantissa = ethers_1.BigNumber.from(0);
    let mantissaPow2 = ethers_1.BigNumber.from(1);
    for (let i = expBits; i < expBits + mantissaBits; i++) {
        if (bits[i] === 1) {
            mantissa = mantissa.add(mantissaPow2);
        }
        mantissaPow2 = mantissaPow2.mul(2);
    }
    return exponent.mul(mantissa);
}
exports.floatToInteger = floatToInteger;
function bitsIntoBytesInBEOrder(bits) {
    if (bits.length % 8 !== 0) {
        throw new Error('wrong number of bits to pack');
    }
    const nBytes = bits.length / 8;
    const resultBytes = new Uint8Array(nBytes);
    for (let byte = 0; byte < nBytes; ++byte) {
        let value = 0;
        if (bits[byte * 8] === 1) {
            value |= 0x80;
        }
        if (bits[byte * 8 + 1] === 1) {
            value |= 0x40;
        }
        if (bits[byte * 8 + 2] === 1) {
            value |= 0x20;
        }
        if (bits[byte * 8 + 3] === 1) {
            value |= 0x10;
        }
        if (bits[byte * 8 + 4] === 1) {
            value |= 0x08;
        }
        if (bits[byte * 8 + 5] === 1) {
            value |= 0x04;
        }
        if (bits[byte * 8 + 6] === 1) {
            value |= 0x02;
        }
        if (bits[byte * 8 + 7] === 1) {
            value |= 0x01;
        }
        resultBytes[byte] = value;
    }
    return resultBytes;
}
exports.bitsIntoBytesInBEOrder = bitsIntoBytesInBEOrder;
function numberToBits(integer, bits) {
    const result = [];
    for (let i = 0; i < bits; i++) {
        result.push(integer & 1);
        integer /= 2;
    }
    return result;
}
function integerToFloat(integer, expBits, mantissaBits, expBase) {
    const maxExponentPower = ethers_1.BigNumber.from(2).pow(expBits).sub(1);
    const maxExponent = ethers_1.BigNumber.from(expBase).pow(maxExponentPower);
    const maxMantissa = ethers_1.BigNumber.from(2).pow(mantissaBits).sub(1);
    if (integer.gt(maxMantissa.mul(maxExponent))) {
        throw new Error('Integer is too big');
    }
    // The algortihm is as follows: calculate minimal exponent
    // such that integer <= max_mantissa * exponent_base ^ exponent,
    // then if this minimal exponent is 0 we can choose mantissa equals integer and exponent equals 0
    // else we need to check two variants:
    // 1) with that minimal exponent
    // 2) with that minimal exponent minus 1
    let exponent = 0;
    let exponentTemp = ethers_1.BigNumber.from(1);
    while (integer.gt(maxMantissa.mul(exponentTemp))) {
        exponentTemp = exponentTemp.mul(expBase);
        exponent += 1;
    }
    let mantissa = integer.div(exponentTemp);
    if (exponent !== 0) {
        const variant1 = exponentTemp.mul(mantissa);
        const variant2 = exponentTemp.div(expBase).mul(maxMantissa);
        const diff1 = integer.sub(variant1);
        const diff2 = integer.sub(variant2);
        if (diff2.lt(diff1)) {
            mantissa = maxMantissa;
            exponent -= 1;
        }
    }
    // encode into bits. First bits of mantissa in LE order
    const encoding = [];
    encoding.push(...numberToBits(exponent, expBits));
    const mantissaNumber = mantissa.toNumber();
    encoding.push(...numberToBits(mantissaNumber, mantissaBits));
    return bitsIntoBytesInBEOrder(encoding.reverse()).reverse();
}
exports.integerToFloat = integerToFloat;
function integerToFloatUp(integer, expBits, mantissaBits, expBase) {
    const maxExponentPower = ethers_1.BigNumber.from(2).pow(expBits).sub(1);
    const maxExponent = ethers_1.BigNumber.from(expBase).pow(maxExponentPower);
    const maxMantissa = ethers_1.BigNumber.from(2).pow(mantissaBits).sub(1);
    if (integer.gt(maxMantissa.mul(maxExponent))) {
        throw new Error('Integer is too big');
    }
    // The algortihm is as follows: calculate minimal exponent
    // such that integer <= max_mantissa * exponent_base ^ exponent,
    // then mantissa is calculated as integer divided by exponent_base ^ exponent and rounded up
    let exponent = 0;
    let exponentTemp = ethers_1.BigNumber.from(1);
    while (integer.gt(maxMantissa.mul(exponentTemp))) {
        exponentTemp = exponentTemp.mul(expBase);
        exponent += 1;
    }
    let mantissa = integer.div(exponentTemp);
    if (!integer.mod(exponentTemp).eq(ethers_1.BigNumber.from(0))) {
        mantissa = mantissa.add(1);
    }
    // encode into bits. First bits of mantissa in LE order
    const encoding = [];
    encoding.push(...numberToBits(exponent, expBits));
    const mantissaNumber = mantissa.toNumber();
    encoding.push(...numberToBits(mantissaNumber, mantissaBits));
    return bitsIntoBytesInBEOrder(encoding.reverse()).reverse();
}
exports.integerToFloatUp = integerToFloatUp;
function reverseBits(buffer) {
    const reversed = buffer.reverse();
    reversed.map((b) => {
        // reverse bits in byte
        b = ((b & 0xf0) >> 4) | ((b & 0x0f) << 4);
        b = ((b & 0xcc) >> 2) | ((b & 0x33) << 2);
        b = ((b & 0xaa) >> 1) | ((b & 0x55) << 1);
        return b;
    });
    return reversed;
}
exports.reverseBits = reverseBits;
function packAmount(amount) {
    return reverseBits(integerToFloat(amount, AMOUNT_EXPONENT_BIT_WIDTH, AMOUNT_MANTISSA_BIT_WIDTH, 10));
}
function packAmountUp(amount) {
    return reverseBits(integerToFloatUp(amount, AMOUNT_EXPONENT_BIT_WIDTH, AMOUNT_MANTISSA_BIT_WIDTH, 10));
}
function packFee(amount) {
    return reverseBits(integerToFloat(amount, FEE_EXPONENT_BIT_WIDTH, FEE_MANTISSA_BIT_WIDTH, 10));
}
function packFeeUp(amount) {
    return reverseBits(integerToFloatUp(amount, FEE_EXPONENT_BIT_WIDTH, FEE_MANTISSA_BIT_WIDTH, 10));
}
function packAmountChecked(amount) {
    if (closestPackableTransactionAmount(amount.toString()).toString() !== amount.toString()) {
        throw new Error('Transaction Amount is not packable');
    }
    return packAmount(amount);
}
exports.packAmountChecked = packAmountChecked;
function packFeeChecked(amount) {
    if (closestPackableTransactionFee(amount.toString()).toString() !== amount.toString()) {
        throw new Error('Fee Amount is not packable');
    }
    return packFee(amount);
}
exports.packFeeChecked = packFeeChecked;
/**
 * packs and unpacks the amount, returning the closest packed value.
 * e.g 1000000003 => 1000000000
 * @param amount
 */
function closestPackableTransactionAmount(amount) {
    const packedAmount = packAmount(ethers_1.BigNumber.from(amount));
    return floatToInteger(packedAmount, AMOUNT_EXPONENT_BIT_WIDTH, AMOUNT_MANTISSA_BIT_WIDTH, 10);
}
exports.closestPackableTransactionAmount = closestPackableTransactionAmount;
function closestGreaterOrEqPackableTransactionAmount(amount) {
    const packedAmount = packAmountUp(ethers_1.BigNumber.from(amount));
    return floatToInteger(packedAmount, AMOUNT_EXPONENT_BIT_WIDTH, AMOUNT_MANTISSA_BIT_WIDTH, 10);
}
exports.closestGreaterOrEqPackableTransactionAmount = closestGreaterOrEqPackableTransactionAmount;
function isTransactionAmountPackable(amount) {
    return closestPackableTransactionAmount(amount).eq(amount);
}
exports.isTransactionAmountPackable = isTransactionAmountPackable;
/**
 * packs and unpacks the amount, returning the closest packed value.
 * e.g 1000000003 => 1000000000
 * @param fee
 */
function closestPackableTransactionFee(fee) {
    const packedFee = packFee(ethers_1.BigNumber.from(fee));
    return floatToInteger(packedFee, FEE_EXPONENT_BIT_WIDTH, FEE_MANTISSA_BIT_WIDTH, 10);
}
exports.closestPackableTransactionFee = closestPackableTransactionFee;
function closestGreaterOrEqPackableTransactionFee(fee) {
    const packedFee = packFeeUp(ethers_1.BigNumber.from(fee));
    return floatToInteger(packedFee, FEE_EXPONENT_BIT_WIDTH, FEE_MANTISSA_BIT_WIDTH, 10);
}
exports.closestGreaterOrEqPackableTransactionFee = closestGreaterOrEqPackableTransactionFee;
function isTransactionFeePackable(amount) {
    return closestPackableTransactionFee(amount).eq(amount);
}
exports.isTransactionFeePackable = isTransactionFeePackable;
// Check that this token could be an NFT.
// NFT is not represented in TokenSets, so we cannot check the availability of NFT in TokenSets
function isNFT(token) {
    return typeof token === 'number' && token >= exports.MIN_NFT_TOKEN_ID;
}
exports.isNFT = isNFT;
function buffer2bitsBE(buff) {
    const res = new Array(buff.length * 8);
    for (let i = 0; i < buff.length; i++) {
        const b = buff[i];
        res[i * 8] = (b & 0x80) !== 0 ? 1 : 0;
        res[i * 8 + 1] = (b & 0x40) !== 0 ? 1 : 0;
        res[i * 8 + 2] = (b & 0x20) !== 0 ? 1 : 0;
        res[i * 8 + 3] = (b & 0x10) !== 0 ? 1 : 0;
        res[i * 8 + 4] = (b & 0x08) !== 0 ? 1 : 0;
        res[i * 8 + 5] = (b & 0x04) !== 0 ? 1 : 0;
        res[i * 8 + 6] = (b & 0x02) !== 0 ? 1 : 0;
        res[i * 8 + 7] = (b & 0x01) !== 0 ? 1 : 0;
    }
    return res;
}
exports.buffer2bitsBE = buffer2bitsBE;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
function isTokenRBTC(token) {
    return token === 'RBTC' || token === ethers_1.constants.AddressZero;
}
exports.isTokenRBTC = isTokenRBTC;
class TokenSet {
    // TODO: handle stale entries, edge case when we rename token after adding it (ZKS-120).
    constructor(tokensBySymbol) {
        this.tokensBySymbol = tokensBySymbol;
    }
    resolveTokenObject(tokenLike) {
        if (this.tokensBySymbol[tokenLike]) {
            return this.tokensBySymbol[tokenLike];
        }
        for (const token of Object.values(this.tokensBySymbol)) {
            if (typeof tokenLike === 'number') {
                if (token.id === tokenLike) {
                    return token;
                }
            }
            else if (token.address.toLocaleLowerCase() === tokenLike.toLocaleLowerCase() ||
                token.symbol.toLocaleLowerCase() === tokenLike.toLocaleLowerCase()) {
                return token;
            }
        }
        throw new Error(`Token ${tokenLike} is not supported`);
    }
    isTokenTransferAmountPackable(tokenLike, amount) {
        const parsedAmount = this.parseToken(tokenLike, amount);
        return isTransactionAmountPackable(parsedAmount);
    }
    isTokenTransactionFeePackable(tokenLike, amount) {
        const parsedAmount = this.parseToken(tokenLike, amount);
        return isTransactionFeePackable(parsedAmount);
    }
    formatToken(tokenLike, amount) {
        const decimals = this.resolveTokenDecimals(tokenLike);
        const value = ethers_1.utils.formatUnits(amount, decimals);
        // We need to add this check to support broader versions of ethers
        // since the `formatUnits` function behaves differently within ^5.0.0 versions
        return value.includes('.') ? value : value + '.0';
    }
    parseToken(tokenLike, amount) {
        const decimals = this.resolveTokenDecimals(tokenLike);
        return ethers_1.utils.parseUnits(amount, decimals);
    }
    resolveTokenDecimals(tokenLike) {
        if (isNFT(tokenLike)) {
            return 0;
        }
        return this.resolveTokenObject(tokenLike).decimals;
    }
    resolveTokenId(tokenLike) {
        if (isNFT(tokenLike)) {
            return tokenLike;
        }
        return this.resolveTokenObject(tokenLike).id;
    }
    resolveTokenAddress(tokenLike) {
        return this.resolveTokenObject(tokenLike).address;
    }
    resolveTokenSymbol(tokenLike) {
        return this.resolveTokenObject(tokenLike).symbol;
    }
}
exports.TokenSet = TokenSet;
function getChangePubkeyMessage(pubKeyHash, nonce, accountId, batchHash) {
    const msgBatchHash = batchHash == undefined ? new Uint8Array(32).fill(0) : ethers_1.ethers.utils.arrayify(batchHash);
    const msgNonce = serializeNonce(nonce);
    const msgAccId = serializeAccountId(accountId);
    const msgPubKeyHash = serializeAddress(pubKeyHash);
    return ethers_1.ethers.utils.concat([msgPubKeyHash, msgNonce, msgAccId, msgBatchHash]);
}
exports.getChangePubkeyMessage = getChangePubkeyMessage;
function getChangePubkeyLegacyMessage(pubKeyHash, nonce, accountId) {
    const msgNonce = ethers_1.utils.hexlify(serializeNonce(nonce));
    const msgAccId = ethers_1.utils.hexlify(serializeAccountId(accountId));
    const msgPubKeyHash = ethers_1.utils.hexlify(serializeAddress(pubKeyHash)).substr(2);
    const message = `Register Rollup pubkey:\n\n` +
        `${msgPubKeyHash}\n` +
        `nonce: ${msgNonce}\n` +
        `account id: ${msgAccId}\n\n` +
        `Only sign this message for a trusted client!`;
    return ethers_1.utils.toUtf8Bytes(message);
}
exports.getChangePubkeyLegacyMessage = getChangePubkeyLegacyMessage;
function getToggle2FAMessage(require2FA, timestamp, pubKeyHash) {
    let message;
    if (require2FA) {
        message =
            `By signing this message, you are opting into Two-factor Authentication protection by the Rollup Server.\n` +
                `Transactions now require signatures by both your L1 and L2 private key.\n` +
                `Timestamp: ${timestamp}`;
    }
    else {
        message =
            `You are opting out of Two-factor Authentication protection by the Rollup Server.\n` +
                `Transactions now only require signatures by your L2 private key.\n` +
                `BY SIGNING THIS MESSAGE, YOU ARE TRUSTING YOUR WALLET CLIENT TO KEEP YOUR L2 PRIVATE KEY SAFE!\n` +
                `Timestamp: ${timestamp}`;
    }
    if (pubKeyHash) {
        message += `\nPubKeyHash: ${pubKeyHash}`;
    }
    return ethers_1.utils.toUtf8Bytes(message);
}
exports.getToggle2FAMessage = getToggle2FAMessage;
function getSignedBytesFromMessage(message, addPrefix) {
    let messageBytes = typeof message === 'string' ? ethers_1.utils.toUtf8Bytes(message) : ethers_1.utils.arrayify(message);
    if (addPrefix) {
        messageBytes = ethers_1.utils.concat([
            ethers_1.utils.toUtf8Bytes(`\x19Ethereum Signed Message:\n${messageBytes.length}`),
            messageBytes
        ]);
    }
    return messageBytes;
}
exports.getSignedBytesFromMessage = getSignedBytesFromMessage;
function signMessagePersonalAPI(signer, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (signer instanceof ethers_1.ethers.providers.JsonRpcSigner) {
            return signer.provider.send('personal_sign', [ethers_1.utils.hexlify(message), yield signer.getAddress()]).then((sign) => sign, (err) => {
                // We check for method name in the error string because error messages about invalid method name
                // often contain method name.
                if (err.message.includes('personal_sign')) {
                    // If no "personal_sign", use "eth_sign"
                    return signer.signMessage(message);
                }
                throw err;
            });
        }
        else {
            return signer.signMessage(message);
        }
    });
}
exports.signMessagePersonalAPI = signMessagePersonalAPI;
function verifyERC1271Signature(address, message, signature, signerOrProvider, messagePrefixed = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const EIP1271_SUCCESS_VALUE = '0x1626ba7e';
        const signMessage = getSignedBytesFromMessage(message, messagePrefixed);
        const signMessageHash = ethers_1.utils.keccak256(signMessage);
        const eip1271 = new ethers_1.ethers.Contract(address, exports.IEIP1271_INTERFACE, signerOrProvider);
        const eipRetVal = yield eip1271.isValidSignature(signMessageHash, signature);
        return eipRetVal === EIP1271_SUCCESS_VALUE;
    });
}
exports.verifyERC1271Signature = verifyERC1271Signature;
function getEthSignatureType(_provider, message, signature, address) {
    return __awaiter(this, void 0, void 0, function* () {
        const messageBytes = typeof message === 'string' ? ethers_1.utils.toUtf8Bytes(message) : ethers_1.utils.arrayify(message);
        const messageNoPrefix = getSignedBytesFromMessage(messageBytes, false);
        const messageWithPrefix = getSignedBytesFromMessage(messageBytes, true);
        const prefixedECDSASigner = ethers_1.utils.recoverAddress(ethers_1.utils.keccak256(messageWithPrefix), signature);
        if (prefixedECDSASigner.toLowerCase() === address.toLowerCase()) {
            return {
                verificationMethod: 'ECDSA',
                isSignedMsgPrefixed: true
            };
        }
        const notPrefixedMsgECDSASigner = ethers_1.utils.recoverAddress(ethers_1.utils.keccak256(messageNoPrefix), signature);
        if (notPrefixedMsgECDSASigner.toLowerCase() === address.toLowerCase()) {
            return {
                verificationMethod: 'ECDSA',
                isSignedMsgPrefixed: false
            };
        }
        let isSignedMsgPrefixed = null;
        // Sometimes an error is thrown if the signature is wrong
        try {
            isSignedMsgPrefixed = yield verifyERC1271Signature(address, messageNoPrefix, signature, _provider);
        }
        catch (_a) {
            isSignedMsgPrefixed = false;
        }
        return {
            verificationMethod: 'ERC-1271',
            isSignedMsgPrefixed
        };
    });
}
exports.getEthSignatureType = getEthSignatureType;
function removeAddressPrefix(address) {
    if (address.startsWith('0x'))
        return address.substr(2);
    if (address.startsWith('sync:'))
        return address.substr(5);
    throw new Error("ETH address must start with '0x' and PubKeyHash must start with 'sync:'");
}
function serializeContentHash(contentHash) {
    const contentHashBytes = ethers_1.utils.arrayify(contentHash);
    if (contentHashBytes.length !== 32) {
        throw new Error('Content hash must be 32 bytes long');
    }
    return contentHashBytes;
}
exports.serializeContentHash = serializeContentHash;
// PubKeyHash or eth address
function serializeAddress(address) {
    const prefixlessAddress = removeAddressPrefix(address);
    const addressBytes = ethers_1.utils.arrayify(`0x${prefixlessAddress}`);
    if (addressBytes.length !== 20) {
        throw new Error('Address must be 20 bytes long');
    }
    return addressBytes;
}
exports.serializeAddress = serializeAddress;
function serializeAccountId(accountId) {
    if (accountId < 0) {
        throw new Error('Negative account id');
    }
    if (accountId >= MAX_NUMBER_OF_ACCOUNTS) {
        throw new Error('AccountId is too big');
    }
    return numberToBytesBE(accountId, 4);
}
exports.serializeAccountId = serializeAccountId;
function serializeTokenId(tokenId) {
    if (tokenId < 0) {
        throw new Error('Negative tokenId');
    }
    if (tokenId >= MAX_NUMBER_OF_TOKENS) {
        throw new Error('TokenId is too big');
    }
    return numberToBytesBE(tokenId, 4);
}
exports.serializeTokenId = serializeTokenId;
function serializeAmountPacked(amount) {
    return packAmountChecked(ethers_1.BigNumber.from(amount));
}
exports.serializeAmountPacked = serializeAmountPacked;
function serializeAmountFull(amount) {
    const bnAmount = ethers_1.BigNumber.from(amount);
    return ethers_1.utils.zeroPad(ethers_1.utils.arrayify(bnAmount), 16);
}
exports.serializeAmountFull = serializeAmountFull;
function serializeFeePacked(fee) {
    return packFeeChecked(ethers_1.BigNumber.from(fee));
}
exports.serializeFeePacked = serializeFeePacked;
function serializeNonce(nonce) {
    if (nonce < 0) {
        throw new Error('Negative nonce');
    }
    return numberToBytesBE(nonce, 4);
}
exports.serializeNonce = serializeNonce;
function serializeTimestamp(time) {
    if (time < 0) {
        throw new Error('Negative timestamp');
    }
    return ethers_1.ethers.utils.concat([new Uint8Array(4), numberToBytesBE(time, 4)]);
}
exports.serializeTimestamp = serializeTimestamp;
function serializeOrder(order) {
    const type = new Uint8Array(['o'.charCodeAt(0)]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountId = serializeAccountId(order.accountId);
    const recipientBytes = serializeAddress(order.recipient);
    const nonceBytes = serializeNonce(order.nonce);
    const tokenSellId = serializeTokenId(order.tokenSell);
    const tokenBuyId = serializeTokenId(order.tokenBuy);
    const sellPriceBytes = ethers_1.BigNumber.from(order.ratio[0]).toHexString();
    const buyPriceBytes = ethers_1.BigNumber.from(order.ratio[1]).toHexString();
    const amountBytes = serializeAmountPacked(order.amount);
    const validFrom = serializeTimestamp(order.validFrom);
    const validUntil = serializeTimestamp(order.validUntil);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        accountId,
        recipientBytes,
        nonceBytes,
        tokenSellId,
        tokenBuyId,
        ethers_1.ethers.utils.zeroPad(sellPriceBytes, 15),
        ethers_1.ethers.utils.zeroPad(buyPriceBytes, 15),
        amountBytes,
        validFrom,
        validUntil
    ]);
}
exports.serializeOrder = serializeOrder;
function serializeSwap(swap) {
    return __awaiter(this, void 0, void 0, function* () {
        const type = new Uint8Array([255 - 11]);
        const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
        const submitterId = serializeAccountId(swap.submitterId);
        const submitterAddress = serializeAddress(swap.submitterAddress);
        const nonceBytes = serializeNonce(swap.nonce);
        const orderA = serializeOrder(swap.orders[0]);
        const orderB = serializeOrder(swap.orders[1]);
        const ordersHashed = yield (0, crypto_1.rescueHashOrders)(ethers_1.ethers.utils.concat([orderA, orderB]));
        const tokenIdBytes = serializeTokenId(swap.feeToken);
        const feeBytes = serializeFeePacked(swap.fee);
        const amountABytes = serializeAmountPacked(swap.amounts[0]);
        const amountBBytes = serializeAmountPacked(swap.amounts[1]);
        return ethers_1.ethers.utils.concat([
            type,
            version,
            submitterId,
            submitterAddress,
            nonceBytes,
            ordersHashed,
            tokenIdBytes,
            feeBytes,
            amountABytes,
            amountBBytes
        ]);
    });
}
exports.serializeSwap = serializeSwap;
function serializeWithdraw(withdraw) {
    const type = new Uint8Array([255 - 3]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountId = serializeAccountId(withdraw.accountId);
    const accountBytes = serializeAddress(withdraw.from);
    const ethAddressBytes = serializeAddress(withdraw.to);
    const tokenIdBytes = serializeTokenId(withdraw.token);
    const amountBytes = serializeAmountFull(withdraw.amount);
    const feeBytes = serializeFeePacked(withdraw.fee);
    const nonceBytes = serializeNonce(withdraw.nonce);
    const validFrom = serializeTimestamp(withdraw.validFrom);
    const validUntil = serializeTimestamp(withdraw.validUntil);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        accountId,
        accountBytes,
        ethAddressBytes,
        tokenIdBytes,
        amountBytes,
        feeBytes,
        nonceBytes,
        validFrom,
        validUntil
    ]);
}
exports.serializeWithdraw = serializeWithdraw;
function serializeMintNFT(mintNFT) {
    const type = new Uint8Array([255 - 9]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountId = serializeAccountId(mintNFT.creatorId);
    const accountBytes = serializeAddress(mintNFT.creatorAddress);
    const contentHashBytes = serializeContentHash(mintNFT.contentHash);
    const recipientBytes = serializeAddress(mintNFT.recipient);
    const tokenIdBytes = serializeTokenId(mintNFT.feeToken);
    const feeBytes = serializeFeePacked(mintNFT.fee);
    const nonceBytes = serializeNonce(mintNFT.nonce);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        accountId,
        accountBytes,
        contentHashBytes,
        recipientBytes,
        tokenIdBytes,
        feeBytes,
        nonceBytes
    ]);
}
exports.serializeMintNFT = serializeMintNFT;
function serializeWithdrawNFT(withdrawNFT) {
    const type = new Uint8Array([255 - 10]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountId = serializeAccountId(withdrawNFT.accountId);
    const accountBytes = serializeAddress(withdrawNFT.from);
    const ethAddressBytes = serializeAddress(withdrawNFT.to);
    const tokenBytes = serializeTokenId(withdrawNFT.token);
    const tokenIdBytes = serializeTokenId(withdrawNFT.feeToken);
    const feeBytes = serializeFeePacked(withdrawNFT.fee);
    const nonceBytes = serializeNonce(withdrawNFT.nonce);
    const validFrom = serializeTimestamp(withdrawNFT.validFrom);
    const validUntil = serializeTimestamp(withdrawNFT.validUntil);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        accountId,
        accountBytes,
        ethAddressBytes,
        tokenBytes,
        tokenIdBytes,
        feeBytes,
        nonceBytes,
        validFrom,
        validUntil
    ]);
}
exports.serializeWithdrawNFT = serializeWithdrawNFT;
function serializeTransfer(transfer) {
    const type = new Uint8Array([255 - 5]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountId = serializeAccountId(transfer.accountId);
    const from = serializeAddress(transfer.from);
    const to = serializeAddress(transfer.to);
    const token = serializeTokenId(transfer.token);
    const amount = serializeAmountPacked(transfer.amount);
    const fee = serializeFeePacked(transfer.fee);
    const nonce = serializeNonce(transfer.nonce);
    const validFrom = serializeTimestamp(transfer.validFrom);
    const validUntil = serializeTimestamp(transfer.validUntil);
    return ethers_1.ethers.utils.concat([type, version, accountId, from, to, token, amount, fee, nonce, validFrom, validUntil]);
}
exports.serializeTransfer = serializeTransfer;
function serializeChangePubKey(changePubKey) {
    const type = new Uint8Array([255 - 7]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const accountIdBytes = serializeAccountId(changePubKey.accountId);
    const accountBytes = serializeAddress(changePubKey.account);
    const pubKeyHashBytes = serializeAddress(changePubKey.newPkHash);
    const tokenIdBytes = serializeTokenId(changePubKey.feeToken);
    const feeBytes = serializeFeePacked(changePubKey.fee);
    const nonceBytes = serializeNonce(changePubKey.nonce);
    const validFrom = serializeTimestamp(changePubKey.validFrom);
    const validUntil = serializeTimestamp(changePubKey.validUntil);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        accountIdBytes,
        accountBytes,
        pubKeyHashBytes,
        tokenIdBytes,
        feeBytes,
        nonceBytes,
        validFrom,
        validUntil
    ]);
}
exports.serializeChangePubKey = serializeChangePubKey;
function serializeForcedExit(forcedExit) {
    const type = new Uint8Array([255 - 8]);
    const version = new Uint8Array([exports.CURRENT_TX_VERSION]);
    const initiatorAccountIdBytes = serializeAccountId(forcedExit.initiatorAccountId);
    const targetBytes = serializeAddress(forcedExit.target);
    const tokenIdBytes = serializeTokenId(forcedExit.token);
    const feeBytes = serializeFeePacked(forcedExit.fee);
    const nonceBytes = serializeNonce(forcedExit.nonce);
    const validFrom = serializeTimestamp(forcedExit.validFrom);
    const validUntil = serializeTimestamp(forcedExit.validUntil);
    return ethers_1.ethers.utils.concat([
        type,
        version,
        initiatorAccountIdBytes,
        targetBytes,
        tokenIdBytes,
        feeBytes,
        nonceBytes,
        validFrom,
        validUntil
    ]);
}
exports.serializeForcedExit = serializeForcedExit;
/**
 * Encodes the transaction data as the byte sequence according to the Rollup protocol.
 * @param tx A transaction to serialize.
 */
function serializeTx(tx) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (tx.type) {
            case 'Transfer':
                return serializeTransfer(tx);
            case 'Withdraw':
                return serializeWithdraw(tx);
            case 'ChangePubKey':
                return serializeChangePubKey(tx);
            case 'ForcedExit':
                return serializeForcedExit(tx);
            case 'MintNFT':
                return serializeMintNFT(tx);
            case 'WithdrawNFT':
                return serializeWithdrawNFT(tx);
            case 'Swap':
                // this returns a promise
                return serializeSwap(tx);
            default:
                return new Uint8Array();
        }
    });
}
exports.serializeTx = serializeTx;
function numberToBytesBE(number, bytes) {
    const result = new Uint8Array(bytes);
    for (let i = bytes - 1; i >= 0; i--) {
        result[i] = number & 0xff;
        number >>= 8;
    }
    return result;
}
exports.numberToBytesBE = numberToBytesBE;
function parseHexWithPrefix(str) {
    return Uint8Array.from(Buffer.from(str.slice(2), 'hex'));
}
exports.parseHexWithPrefix = parseHexWithPrefix;
function getCREATE2AddressAndSalt(syncPubkeyHash, create2Data) {
    const pubkeyHashHex = syncPubkeyHash.replace('sync:', '0x');
    const additionalSaltArgument = ethers_1.ethers.utils.arrayify(create2Data.saltArg);
    if (additionalSaltArgument.length !== 32) {
        throw new Error('create2Data.saltArg should be exactly 32 bytes long');
    }
    // CREATE2 salt
    const salt = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.concat([additionalSaltArgument, pubkeyHashHex]));
    // Address according to CREATE2 specification
    const address = '0x' +
        ethers_1.ethers.utils
            .keccak256(ethers_1.ethers.utils.concat([
            ethers_1.ethers.utils.arrayify(0xff),
            ethers_1.ethers.utils.arrayify(create2Data.creatorAddress),
            salt,
            ethers_1.ethers.utils.arrayify(create2Data.codeHash)
        ]))
            .slice(2 + 12 * 2);
    return { address: address, salt: ethers_1.ethers.utils.hexlify(salt) };
}
exports.getCREATE2AddressAndSalt = getCREATE2AddressAndSalt;
function getEthereumBalance(ethProvider, syncProvider, address, token) {
    return __awaiter(this, void 0, void 0, function* () {
        let balance;
        if (isTokenRBTC(token)) {
            balance = yield ethProvider.getBalance(address);
        }
        else {
            const erc20contract = new ethers_1.Contract(syncProvider.tokenSet.resolveTokenAddress(token), exports.IERC20_INTERFACE, ethProvider);
            balance = yield erc20contract.balanceOf(address);
        }
        return balance;
    });
}
exports.getEthereumBalance = getEthereumBalance;
function getPendingBalance(ethProvider, syncProvider, address, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const zksyncContract = new ethers_1.Contract(syncProvider.contractAddress.mainContract, exports.SYNC_MAIN_CONTRACT_INTERFACE, ethProvider);
        const tokenAddress = syncProvider.tokenSet.resolveTokenAddress(token);
        return zksyncContract.getPendingBalance(address, tokenAddress);
    });
}
exports.getPendingBalance = getPendingBalance;
function getTxHash(tx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (tx.type == 'Close') {
            throw new Error('Close operation is disabled');
        }
        let txBytes = yield serializeTx(tx);
        return ethers_1.ethers.utils.sha256(txBytes).replace('0x', 'sync-tx:');
    });
}
exports.getTxHash = getTxHash;
