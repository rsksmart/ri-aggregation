"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Signer_privateKey;
Object.defineProperty(exports, "__esModule", { value: true });
exports.unableToSign = exports.No2FAWalletSigner = exports.Create2WalletSigner = exports.Signer = void 0;
const crypto_1 = require("./crypto");
const ethers_1 = require("ethers");
const utils = __importStar(require("./utils"));
class Signer {
    constructor(privKey) {
        _Signer_privateKey.set(this, void 0);
        __classPrivateFieldSet(this, _Signer_privateKey, privKey, "f");
    }
    pubKeyHash() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, crypto_1.privateKeyToPubKeyHash)(__classPrivateFieldGet(this, _Signer_privateKey, "f"));
        });
    }
    signMintNFT(mintNft) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, mintNft), { type: 'MintNFT', feeToken: mintNft.feeTokenId });
            const msgBytes = utils.serializeMintNFT(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { fee: ethers_1.BigNumber.from(mintNft.fee).toString(), signature });
        });
    }
    signWithdrawNFT(withdrawNft) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, withdrawNft), { type: 'WithdrawNFT', token: withdrawNft.tokenId, feeToken: withdrawNft.feeTokenId });
            const msgBytes = utils.serializeWithdrawNFT(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { fee: ethers_1.BigNumber.from(withdrawNft.fee).toString(), signature });
        });
    }
    /**
     * @deprecated `Signer.*SignBytes` methods will be removed in future. Use `utils.serializeTx` instead.
     */
    transferSignBytes(transfer) {
        return utils.serializeTransfer(Object.assign(Object.assign({}, transfer), { type: 'Transfer', token: transfer.tokenId }));
    }
    signSyncOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const msgBytes = utils.serializeOrder(order);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, order), { amount: ethers_1.BigNumber.from(order.amount).toString(), ratio: order.ratio.map((p) => ethers_1.BigNumber.from(p).toString()), signature });
        });
    }
    signSyncSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, swap), { type: 'Swap' });
            const msgBytes = yield utils.serializeSwap(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { amounts: [ethers_1.BigNumber.from(tx.amounts[0]).toString(), ethers_1.BigNumber.from(tx.amounts[1]).toString()], fee: ethers_1.BigNumber.from(tx.fee).toString(), signature });
        });
    }
    signSyncTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, transfer), { type: 'Transfer', token: transfer.tokenId });
            const msgBytes = utils.serializeTransfer(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { amount: ethers_1.BigNumber.from(transfer.amount).toString(), fee: ethers_1.BigNumber.from(transfer.fee).toString(), signature });
        });
    }
    /**
     * @deprecated `Signer.*SignBytes` methods will be removed in future. Use `utils.serializeTx` instead.
     */
    withdrawSignBytes(withdraw) {
        return utils.serializeWithdraw(Object.assign(Object.assign({}, withdraw), { type: 'Withdraw', to: withdraw.ethAddress, token: withdraw.tokenId }));
    }
    signSyncWithdraw(withdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, withdraw), { type: 'Withdraw', to: withdraw.ethAddress, token: withdraw.tokenId });
            const msgBytes = utils.serializeWithdraw(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { amount: ethers_1.BigNumber.from(withdraw.amount).toString(), fee: ethers_1.BigNumber.from(withdraw.fee).toString(), signature });
        });
    }
    /**
     * @deprecated `Signer.*SignBytes` methods will be removed in future. Use `utils.serializeTx` instead.
     */
    forcedExitSignBytes(forcedExit) {
        return utils.serializeForcedExit(Object.assign(Object.assign({}, forcedExit), { type: 'ForcedExit', token: forcedExit.tokenId }));
    }
    signSyncForcedExit(forcedExit) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, forcedExit), { type: 'ForcedExit', token: forcedExit.tokenId });
            const msgBytes = utils.serializeForcedExit(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { fee: ethers_1.BigNumber.from(forcedExit.fee).toString(), signature });
        });
    }
    /**
     * @deprecated `Signer.*SignBytes` methods will be removed in future. Use `utils.serializeTx` instead.
     */
    changePubKeySignBytes(changePubKey) {
        return utils.serializeChangePubKey(Object.assign(Object.assign({}, changePubKey), { type: 'ChangePubKey', feeToken: changePubKey.feeTokenId, 
            // this is not important for serialization
            ethAuthData: { type: 'Onchain' } }));
    }
    signSyncChangePubKey(changePubKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = Object.assign(Object.assign({}, changePubKey), { type: 'ChangePubKey', feeToken: changePubKey.feeTokenId });
            const msgBytes = utils.serializeChangePubKey(tx);
            const signature = yield (0, crypto_1.signTransactionBytes)(__classPrivateFieldGet(this, _Signer_privateKey, "f"), msgBytes);
            return Object.assign(Object.assign({}, tx), { fee: ethers_1.BigNumber.from(changePubKey.fee).toString(), signature });
        });
    }
    static fromPrivateKey(pk) {
        return new Signer(pk);
    }
    static fromSeed(seed) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Signer(yield (0, crypto_1.privateKeyFromSeed)(seed));
        });
    }
    static fromETHSignature(ethSigner) {
        return __awaiter(this, void 0, void 0, function* () {
            let chainID = 30;
            if (ethSigner.provider) {
                const network = yield ethSigner.provider.getNetwork();
                chainID = network.chainId;
            }
            let message = 'Access Rollup account.\n\nOnly sign this message for a trusted client!';
            if (chainID !== 30) {
                message += `\nChain ID: ${chainID}.`;
            }
            const signedBytes = utils.getSignedBytesFromMessage(message, false);
            const signature = yield utils.signMessagePersonalAPI(ethSigner, signedBytes);
            const address = yield ethSigner.getAddress();
            const ethSignatureType = yield utils.getEthSignatureType(ethSigner.provider, message, signature, address);
            const seed = ethers_1.ethers.utils.arrayify(signature);
            const signer = yield Signer.fromSeed(seed);
            return { signer, ethSignatureType };
        });
    }
}
exports.Signer = Signer;
_Signer_privateKey = new WeakMap();
class Create2WalletSigner extends ethers_1.ethers.Signer {
    constructor(zkSyncPubkeyHash, create2WalletData, provider) {
        super();
        this.zkSyncPubkeyHash = zkSyncPubkeyHash;
        this.create2WalletData = create2WalletData;
        Object.defineProperty(this, 'provider', {
            enumerable: true,
            value: provider,
            writable: false
        });
        const create2Info = utils.getCREATE2AddressAndSalt(zkSyncPubkeyHash, create2WalletData);
        this.address = create2Info.address;
        this.salt = create2Info.salt;
    }
    getAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.address;
        });
    }
    /**
     * This signer can't sign messages but we return zeroed signature bytes to comply with ethers API.
     */
    signMessage(_message) {
        return __awaiter(this, void 0, void 0, function* () {
            return ethers_1.ethers.utils.hexlify(new Uint8Array(65));
        });
    }
    signTransaction(_message) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("Create2Wallet signer can't sign transactions");
        });
    }
    connect(provider) {
        return new Create2WalletSigner(this.zkSyncPubkeyHash, this.create2WalletData, provider);
    }
}
exports.Create2WalletSigner = Create2WalletSigner;
class No2FAWalletSigner extends ethers_1.ethers.Signer {
    constructor(address, provider) {
        super();
        this.address = address;
        Object.defineProperty(this, 'provider', {
            enumerable: true,
            value: provider,
            writable: false
        });
    }
    getAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.address;
        });
    }
    /**
     * This signer can't sign messages but we return zeroed signature bytes to comply with ethers API.
     */
    signMessage(_message) {
        return __awaiter(this, void 0, void 0, function* () {
            return ethers_1.ethers.utils.hexlify(new Uint8Array(65));
        });
    }
    signTransaction(_message) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("No2FAWallet signer can't sign transactions");
        });
    }
    connect(provider) {
        return new No2FAWalletSigner(this.address, provider);
    }
}
exports.No2FAWalletSigner = No2FAWalletSigner;
function unableToSign(signer) {
    return signer instanceof Create2WalletSigner || signer instanceof No2FAWalletSigner;
}
exports.unableToSign = unableToSign;
