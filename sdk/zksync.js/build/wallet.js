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
exports.Wallet = exports.submitSignedTransactionsBatch = exports.submitSignedTransaction = exports.ETHOperation = exports.Transaction = void 0;
const ethers_1 = require("ethers");
const eth_message_signer_1 = require("./eth-message-signer");
const signer_1 = require("./signer");
const utils_1 = require("./utils");
const operations_1 = require("./operations");
const abstract_wallet_1 = require("./abstract-wallet");
var operations_2 = require("./operations");
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return operations_2.Transaction; } });
Object.defineProperty(exports, "ETHOperation", { enumerable: true, get: function () { return operations_2.ETHOperation; } });
Object.defineProperty(exports, "submitSignedTransaction", { enumerable: true, get: function () { return operations_2.submitSignedTransaction; } });
Object.defineProperty(exports, "submitSignedTransactionsBatch", { enumerable: true, get: function () { return operations_2.submitSignedTransactionsBatch; } });
class Wallet extends abstract_wallet_1.AbstractWallet {
    constructor(_ethSigner, _ethMessageSigner, cachedAddress, signer, accountId, ethSignerType) {
        super(cachedAddress, accountId);
        this._ethSigner = _ethSigner;
        this._ethMessageSigner = _ethMessageSigner;
        this.signer = signer;
        this.ethSignerType = ethSignerType;
    }
    // ************
    // Constructors
    //
    static fromEthSigner(ethWallet, provider, signer, accountId, ethSignerType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (signer == null) {
                const signerResult = yield signer_1.Signer.fromETHSignature(ethWallet);
                signer = signerResult.signer;
                ethSignerType = ethSignerType || signerResult.ethSignatureType;
            }
            else if (ethSignerType == null) {
                throw new Error('If you passed signer, you must also pass ethSignerType.');
            }
            const ethMessageSigner = new eth_message_signer_1.EthMessageSigner(ethWallet, ethSignerType);
            const wallet = new Wallet(ethWallet, ethMessageSigner, yield ethWallet.getAddress(), signer, accountId, ethSignerType);
            wallet.connect(provider);
            yield wallet.verifyNetworks();
            return wallet;
        });
    }
    static fromCreate2Data(syncSigner, provider, create2Data, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const create2Signer = new signer_1.Create2WalletSigner(yield syncSigner.pubKeyHash(), create2Data);
            return yield Wallet.fromEthSigner(create2Signer, provider, syncSigner, accountId, {
                verificationMethod: 'ERC-1271',
                isSignedMsgPrefixed: true
            });
        });
    }
    static fromEthSignerNoKeys(ethWallet, provider, accountId, ethSignerType) {
        return __awaiter(this, void 0, void 0, function* () {
            const ethMessageSigner = new eth_message_signer_1.EthMessageSigner(ethWallet, ethSignerType);
            const wallet = new Wallet(ethWallet, ethMessageSigner, yield ethWallet.getAddress(), undefined, accountId, ethSignerType);
            wallet.connect(provider);
            yield wallet.verifyNetworks();
            return wallet;
        });
    }
    static fromSyncSigner(ethWallet, syncSigner, provider, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Wallet.fromEthSigner(ethWallet, provider, syncSigner, accountId, {
                verificationMethod: 'ERC-1271',
                isSignedMsgPrefixed: true
            });
        });
    }
    // ****************
    // Abstract getters
    //
    ethSigner() {
        return this._ethSigner;
    }
    ethMessageSigner() {
        return this._ethMessageSigner;
    }
    syncSignerConnected() {
        return this.signer != null;
    }
    syncSignerPubKeyHash() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.signer.pubKeyHash();
        });
    }
    // *********************
    // Batch builder methods
    //
    processBatchBuilderTransactions(startNonce, txs) {
        return __awaiter(this, void 0, void 0, function* () {
            const processedTxs = [];
            let messages = [];
            let nonce = yield this.getNonce(startNonce);
            const batchNonce = nonce;
            for (const tx of txs) {
                tx.tx.nonce = nonce++;
                switch (tx.type) {
                    case 'Withdraw':
                        messages.push(this.getWithdrawEthMessagePart(tx.tx));
                        const withdraw = { tx: yield this.getWithdrawFromSyncToEthereum(tx.tx) };
                        processedTxs.push(withdraw);
                        break;
                    case 'Transfer':
                        messages.push(yield this.getTransferEthMessagePart(tx.tx));
                        const transfer = { tx: yield this.getTransfer(tx.tx) };
                        processedTxs.push(transfer);
                        break;
                    case 'ChangePubKey':
                        // ChangePubKey requires its own Ethereum signature, we either expect
                        // it to be signed already or do it here.
                        const changePubKey = tx.alreadySigned
                            ? tx.tx
                            : (yield this.signSetSigningKey(tx.tx)).tx;
                        const currentPubKeyHash = yield this.getCurrentPubKeyHash();
                        if (currentPubKeyHash === changePubKey.newPkHash) {
                            throw new Error('Current signing key is already set');
                        }
                        messages.push(this.getChangePubKeyEthMessagePart({
                            pubKeyHash: changePubKey.newPkHash,
                            feeToken: tx.token,
                            fee: changePubKey.fee
                        }));
                        processedTxs.push({ tx: changePubKey });
                        break;
                    case 'ForcedExit':
                        messages.push(this.getForcedExitEthMessagePart(tx.tx));
                        const forcedExit = { tx: yield this.getForcedExit(tx.tx) };
                        processedTxs.push(forcedExit);
                        break;
                    case 'MintNFT':
                        messages.push(this.getMintNFTEthMessagePart(tx.tx));
                        const mintNft = { tx: yield this.getMintNFT(tx.tx) };
                        processedTxs.push(mintNft);
                        break;
                    case 'Swap':
                        messages.push(this.getSwapEthSignMessagePart(tx.tx));
                        const swap = {
                            tx: yield this.getSwap(tx.tx),
                            ethereumSignature: [
                                null,
                                tx.tx.orders[0].ethSignature || null,
                                tx.tx.orders[1].ethSignature || null
                            ]
                        };
                        processedTxs.push(swap);
                        break;
                    case 'WithdrawNFT':
                        messages.push(this.getWithdrawNFTEthMessagePart(tx.tx));
                        const withdrawNft = { tx: yield this.getWithdrawNFT(tx.tx) };
                        processedTxs.push(withdrawNft);
                        break;
                }
            }
            messages.push(`Nonce: ${batchNonce}`);
            const message = messages.filter((part) => part.length != 0).join('\n');
            const signature = yield this.ethMessageSigner().getEthMessageSignature(message);
            return {
                txs: processedTxs,
                signature
            };
        });
    }
    // **************
    // L2 operations
    //
    signSyncTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            transfer.validFrom = transfer.validFrom || 0;
            transfer.validUntil = transfer.validUntil || utils_1.MAX_TIMESTAMP;
            const signedTransferTransaction = yield this.getTransfer(transfer);
            const stringAmount = ethers_1.BigNumber.from(transfer.amount).isZero()
                ? null
                : this.provider.tokenSet.formatToken(transfer.token, transfer.amount);
            const stringFee = ethers_1.BigNumber.from(transfer.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(transfer.token, transfer.fee);
            const stringToken = this.provider.tokenSet.resolveTokenSymbol(transfer.token);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignTransfer({
                    stringAmount,
                    stringFee,
                    stringToken,
                    to: transfer.to,
                    nonce: transfer.nonce,
                    accountId: this.accountId
                });
            return {
                tx: signedTransferTransaction,
                ethereumSignature
            };
        });
    }
    syncTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            transfer.nonce = transfer.nonce != null ? yield this.getNonce(transfer.nonce) : yield this.getNonce();
            if (transfer.fee == null) {
                const fullFee = yield this.provider.getTransactionFee('Transfer', transfer.to, transfer.token);
                transfer.fee = fullFee.totalFee;
            }
            const signedTransferTransaction = yield this.signSyncTransfer(transfer);
            return (0, operations_1.submitSignedTransaction)(signedTransferTransaction, this.provider);
        });
    }
    // ChangePubKey part
    signSetSigningKey(changePubKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const newPubKeyHash = yield this.signer.pubKeyHash();
            let ethAuthData;
            let ethSignature;
            if (changePubKey.ethAuthType === 'Onchain') {
                ethAuthData = {
                    type: 'Onchain'
                };
            }
            else if (changePubKey.ethAuthType === 'ECDSA') {
                yield this.setRequiredAccountIdFromServer('ChangePubKey authorized by ECDSA.');
                const changePubKeyMessage = (0, utils_1.getChangePubkeyMessage)(newPubKeyHash, changePubKey.nonce, this.accountId, changePubKey.batchHash);
                const ethSignature = (yield this.ethMessageSigner().getEthMessageSignature(changePubKeyMessage)).signature;
                ethAuthData = {
                    type: 'ECDSA',
                    ethSignature,
                    batchHash: changePubKey.batchHash
                };
            }
            else if (changePubKey.ethAuthType === 'CREATE2') {
                const ethSigner = this.ethSigner();
                if (ethSigner instanceof signer_1.Create2WalletSigner) {
                    const create2data = ethSigner.create2WalletData;
                    ethAuthData = {
                        type: 'CREATE2',
                        creatorAddress: create2data.creatorAddress,
                        saltArg: create2data.saltArg,
                        codeHash: create2data.codeHash
                    };
                }
                else {
                    throw new Error('CREATE2 wallet authentication is only available for CREATE2 wallets');
                }
            }
            else if (changePubKey.ethAuthType === 'ECDSALegacyMessage') {
                yield this.setRequiredAccountIdFromServer('ChangePubKey authorized by ECDSALegacyMessage.');
                const changePubKeyMessage = (0, utils_1.getChangePubkeyLegacyMessage)(newPubKeyHash, changePubKey.nonce, this.accountId);
                ethSignature = (yield this.ethMessageSigner().getEthMessageSignature(changePubKeyMessage)).signature;
            }
            else {
                throw new Error('Unsupported SetSigningKey type');
            }
            const changePubkeyTxUnsigned = Object.assign(changePubKey, { ethAuthData, ethSignature });
            changePubkeyTxUnsigned.validFrom = changePubKey.validFrom || 0;
            changePubkeyTxUnsigned.validUntil = changePubKey.validUntil || utils_1.MAX_TIMESTAMP;
            const changePubKeyTx = yield this.getChangePubKey(changePubkeyTxUnsigned);
            return {
                tx: changePubKeyTx
            };
        });
    }
    setSigningKey(changePubKey) {
        return __awaiter(this, void 0, void 0, function* () {
            changePubKey.nonce =
                changePubKey.nonce != null ? yield this.getNonce(changePubKey.nonce) : yield this.getNonce();
            if (changePubKey.fee == null) {
                changePubKey.fee = 0;
                if (changePubKey.ethAuthType === 'ECDSALegacyMessage') {
                    const feeType = {
                        ChangePubKey: {
                            onchainPubkeyAuth: false
                        }
                    };
                    const fullFee = yield this.provider.getTransactionFee(feeType, this.address(), changePubKey.feeToken);
                    changePubKey.fee = fullFee.totalFee;
                }
                else {
                    const feeType = {
                        ChangePubKey: changePubKey.ethAuthType
                    };
                    const fullFee = yield this.provider.getTransactionFee(feeType, this.address(), changePubKey.feeToken);
                    changePubKey.fee = fullFee.totalFee;
                }
            }
            const txData = yield this.signSetSigningKey(changePubKey);
            const currentPubKeyHash = yield this.getCurrentPubKeyHash();
            if (currentPubKeyHash === txData.tx.newPkHash) {
                throw new Error('Current signing key is already set');
            }
            return (0, operations_1.submitSignedTransaction)(txData, this.provider);
        });
    }
    // Withdraw part
    signWithdrawFromSyncToEthereum(withdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            withdraw.validFrom = withdraw.validFrom || 0;
            withdraw.validUntil = withdraw.validUntil || utils_1.MAX_TIMESTAMP;
            const signedWithdrawTransaction = yield this.getWithdrawFromSyncToEthereum(withdraw);
            const stringAmount = ethers_1.BigNumber.from(withdraw.amount).isZero()
                ? null
                : this.provider.tokenSet.formatToken(withdraw.token, withdraw.amount);
            const stringFee = ethers_1.BigNumber.from(withdraw.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(withdraw.token, withdraw.fee);
            const stringToken = this.provider.tokenSet.resolveTokenSymbol(withdraw.token);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignWithdraw({
                    stringAmount,
                    stringFee,
                    stringToken,
                    ethAddress: withdraw.ethAddress,
                    nonce: withdraw.nonce,
                    accountId: this.accountId
                });
            return {
                tx: signedWithdrawTransaction,
                ethereumSignature
            };
        });
    }
    withdrawFromSyncToEthereum(withdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            withdraw.nonce = withdraw.nonce != null ? yield this.getNonce(withdraw.nonce) : yield this.getNonce();
            if (withdraw.fee == null) {
                const feeType = withdraw.fastProcessing === true ? 'FastWithdraw' : 'Withdraw';
                const fullFee = yield this.provider.getTransactionFee(feeType, withdraw.ethAddress, withdraw.token);
                withdraw.fee = fullFee.totalFee;
            }
            const signedWithdrawTransaction = yield this.signWithdrawFromSyncToEthereum(withdraw);
            return (0, operations_1.submitSignedTransaction)(signedWithdrawTransaction, this.provider, withdraw.fastProcessing);
        });
    }
    // Forced exit part
    signSyncForcedExit(forcedExit) {
        return __awaiter(this, void 0, void 0, function* () {
            const signedForcedExitTransaction = yield this.getForcedExit(forcedExit);
            const stringFee = ethers_1.BigNumber.from(forcedExit.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(forcedExit.token, forcedExit.fee);
            const stringToken = this.provider.tokenSet.resolveTokenSymbol(forcedExit.token);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignForcedExit({
                    stringToken,
                    stringFee,
                    target: forcedExit.target,
                    nonce: forcedExit.nonce
                });
            return {
                tx: signedForcedExitTransaction,
                ethereumSignature
            };
        });
    }
    syncForcedExit(forcedExit) {
        return __awaiter(this, void 0, void 0, function* () {
            forcedExit.nonce = forcedExit.nonce != null ? yield this.getNonce(forcedExit.nonce) : yield this.getNonce();
            if (forcedExit.fee == null) {
                const fullFee = yield this.provider.getTransactionFee('ForcedExit', forcedExit.target, forcedExit.token);
                forcedExit.fee = fullFee.totalFee;
            }
            const signedForcedExitTransaction = yield this.signSyncForcedExit(forcedExit);
            return (0, operations_1.submitSignedTransaction)(signedForcedExitTransaction, this.provider);
        });
    }
    // Swap part
    signOrder(orderData) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this.getPartialOrder(orderData);
            const stringAmount = ethers_1.BigNumber.from(order.amount).isZero()
                ? null
                : this.provider.tokenSet.formatToken(order.tokenSell, order.amount);
            const stringTokenSell = yield this.provider.getTokenSymbol(order.tokenSell);
            const stringTokenBuy = yield this.provider.getTokenSymbol(order.tokenBuy);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignOrder({
                    amount: stringAmount,
                    tokenSell: stringTokenSell,
                    tokenBuy: stringTokenBuy,
                    nonce: order.nonce,
                    recipient: order.recipient,
                    ratio: order.ratio
                });
            order.ethSignature = ethereumSignature;
            return order;
        });
    }
    signSyncSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            const signedSwapTransaction = yield this.getSwap(swap);
            const stringFee = ethers_1.BigNumber.from(swap.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(swap.feeToken, swap.fee);
            const stringToken = this.provider.tokenSet.resolveTokenSymbol(swap.feeToken);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignSwap({
                    fee: stringFee,
                    feeToken: stringToken,
                    nonce: swap.nonce
                });
            return {
                tx: signedSwapTransaction,
                ethereumSignature: [
                    ethereumSignature,
                    swap.orders[0].ethSignature || null,
                    swap.orders[1].ethSignature || null
                ]
            };
        });
    }
    syncSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            swap.nonce = swap.nonce != null ? yield this.getNonce(swap.nonce) : yield this.getNonce();
            if (swap.fee == null) {
                const fullFee = yield this.provider.getTransactionFee('Swap', this.address(), swap.feeToken);
                swap.fee = fullFee.totalFee;
            }
            if (swap.amounts == null) {
                let amount0 = ethers_1.BigNumber.from(swap.orders[0].amount);
                let amount1 = ethers_1.BigNumber.from(swap.orders[1].amount);
                if (!amount0.eq(0) && !amount1.eq(0)) {
                    swap.amounts = [amount0, amount1];
                }
                else {
                    throw new Error('If amounts in orders are implicit, you must specify them during submission');
                }
            }
            const signedSwapTransaction = yield this.signSyncSwap(swap);
            return (0, operations_1.submitSignedTransaction)(signedSwapTransaction, this.provider);
        });
    }
    // Mint NFT part
    signMintNFT(mintNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            const signedMintNFTTransaction = yield this.getMintNFT(mintNFT);
            const stringFee = ethers_1.BigNumber.from(mintNFT.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(mintNFT.feeToken, mintNFT.fee);
            const stringFeeToken = this.provider.tokenSet.resolveTokenSymbol(mintNFT.feeToken);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignMintNFT({
                    stringFeeToken,
                    stringFee,
                    recipient: mintNFT.recipient,
                    contentHash: mintNFT.contentHash,
                    nonce: mintNFT.nonce
                });
            return {
                tx: signedMintNFTTransaction,
                ethereumSignature
            };
        });
    }
    mintNFT(mintNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            mintNFT.nonce = mintNFT.nonce != null ? yield this.getNonce(mintNFT.nonce) : yield this.getNonce();
            mintNFT.contentHash = ethers_1.ethers.utils.hexlify(mintNFT.contentHash);
            if (mintNFT.fee == null) {
                const fullFee = yield this.provider.getTransactionFee('MintNFT', mintNFT.recipient, mintNFT.feeToken);
                mintNFT.fee = fullFee.totalFee;
            }
            const signedMintNFTTransaction = yield this.signMintNFT(mintNFT);
            return (0, operations_1.submitSignedTransaction)(signedMintNFTTransaction, this.provider, false);
        });
    }
    // Withdraw NFT part
    signWithdrawNFT(withdrawNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            withdrawNFT.validFrom = withdrawNFT.validFrom || 0;
            withdrawNFT.validUntil = withdrawNFT.validUntil || utils_1.MAX_TIMESTAMP;
            const signedWithdrawNFTTransaction = yield this.getWithdrawNFT(withdrawNFT);
            const stringFee = ethers_1.BigNumber.from(withdrawNFT.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(withdrawNFT.feeToken, withdrawNFT.fee);
            const stringFeeToken = this.provider.tokenSet.resolveTokenSymbol(withdrawNFT.feeToken);
            const ethereumSignature = (0, signer_1.unableToSign)(this.ethSigner())
                ? null
                : yield this.ethMessageSigner().ethSignWithdrawNFT({
                    token: withdrawNFT.token,
                    to: withdrawNFT.to,
                    stringFee,
                    stringFeeToken,
                    nonce: withdrawNFT.nonce
                });
            return {
                tx: signedWithdrawNFTTransaction,
                ethereumSignature
            };
        });
    }
    withdrawNFT(withdrawNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            withdrawNFT.nonce = withdrawNFT.nonce != null ? yield this.getNonce(withdrawNFT.nonce) : yield this.getNonce();
            if (!(0, utils_1.isNFT)(withdrawNFT.token)) {
                throw new Error('This token ID does not correspond to an NFT');
            }
            if (withdrawNFT.fee == null) {
                const feeType = withdrawNFT.fastProcessing === true ? 'FastWithdrawNFT' : 'WithdrawNFT';
                const fullFee = yield this.provider.getTransactionFee(feeType, withdrawNFT.to, withdrawNFT.feeToken);
                withdrawNFT.fee = fullFee.totalFee;
            }
            const signedWithdrawNFTTransaction = yield this.signWithdrawNFT(withdrawNFT);
            return (0, operations_1.submitSignedTransaction)(signedWithdrawNFTTransaction, this.provider, withdrawNFT.fastProcessing);
        });
    }
    // Transfer NFT part
    syncTransferNFT(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            transfer.nonce = transfer.nonce != null ? yield this.getNonce(transfer.nonce) : yield this.getNonce();
            let fee;
            if (transfer.fee == null) {
                fee = yield this.provider.getTransactionsBatchFee(['Transfer', 'Transfer'], [transfer.to, this.address()], transfer.feeToken);
            }
            else {
                fee = transfer.fee;
            }
            const txNFT = {
                to: transfer.to,
                token: transfer.token.id,
                amount: 1,
                fee: 0
            };
            const txFee = {
                to: this.address(),
                token: transfer.feeToken,
                amount: 0,
                fee
            };
            return yield this.syncMultiTransfer([txNFT, txFee]);
        });
    }
    // Multi-transfer part
    // Note: this method signature requires to specify fee in each transaction.
    // For details, see the comment on this method in `AbstractWallet` class.
    syncMultiTransfer(transfers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            if (transfers.length == 0)
                return [];
            yield this.setRequiredAccountIdFromServer('Transfer funds');
            let batch = [];
            let messages = [];
            let nextNonce = transfers[0].nonce != null ? yield this.getNonce(transfers[0].nonce) : yield this.getNonce();
            const batchNonce = nextNonce;
            for (let i = 0; i < transfers.length; i++) {
                const transfer = transfers[i];
                const nonce = nextNonce;
                nextNonce += 1;
                const tx = yield this.getTransfer({
                    to: transfer.to,
                    token: transfer.token,
                    amount: transfer.amount,
                    fee: transfer.fee,
                    nonce,
                    validFrom: transfer.validFrom || 0,
                    validUntil: transfer.validUntil || utils_1.MAX_TIMESTAMP
                });
                const message = yield this.getTransferEthMessagePart(transfer);
                messages.push(message);
                batch.push({ tx, signature: null });
            }
            messages.push(`Nonce: ${batchNonce}`);
            const message = messages.filter((part) => part.length != 0).join('\n');
            const ethSignatures = (0, signer_1.unableToSign)(this.ethSigner())
                ? []
                : [yield this.ethMessageSigner().getEthMessageSignature(message)];
            const transactionHashes = yield this.provider.submitTxsBatch(batch, ethSignatures);
            return transactionHashes.map((txHash, idx) => new operations_1.Transaction(batch[idx], txHash, this.provider));
        });
    }
    // ****************
    // Internal methods
    //
    getTransfer(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            yield this.setRequiredAccountIdFromServer('Transfer funds');
            const tokenId = this.provider.tokenSet.resolveTokenId(transfer.token);
            const transactionData = {
                accountId: this.accountId,
                from: this.address(),
                to: transfer.to,
                tokenId,
                amount: transfer.amount,
                fee: transfer.fee,
                nonce: transfer.nonce,
                validFrom: transfer.validFrom,
                validUntil: transfer.validUntil
            };
            return this.signer.signSyncTransfer(transactionData);
        });
    }
    getChangePubKey(changePubKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for current pubkey calculation.');
            }
            const feeTokenId = this.provider.tokenSet.resolveTokenId(changePubKey.feeToken);
            const newPkHash = yield this.signer.pubKeyHash();
            yield this.setRequiredAccountIdFromServer('Set Signing Key');
            const changePubKeyTx = yield this.signer.signSyncChangePubKey({
                accountId: this.accountId,
                account: this.address(),
                newPkHash,
                nonce: changePubKey.nonce,
                feeTokenId,
                fee: ethers_1.BigNumber.from(changePubKey.fee).toString(),
                ethAuthData: changePubKey.ethAuthData,
                ethSignature: changePubKey.ethSignature,
                validFrom: changePubKey.validFrom,
                validUntil: changePubKey.validUntil
            });
            return changePubKeyTx;
        });
    }
    getWithdrawFromSyncToEthereum(withdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            yield this.setRequiredAccountIdFromServer('Withdraw funds');
            const tokenId = this.provider.tokenSet.resolveTokenId(withdraw.token);
            const transactionData = {
                accountId: this.accountId,
                from: this.address(),
                ethAddress: withdraw.ethAddress,
                tokenId,
                amount: withdraw.amount,
                fee: withdraw.fee,
                nonce: withdraw.nonce,
                validFrom: withdraw.validFrom,
                validUntil: withdraw.validUntil
            };
            return yield this.signer.signSyncWithdraw(transactionData);
        });
    }
    getForcedExit(forcedExit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            yield this.setRequiredAccountIdFromServer('perform a Forced Exit');
            const tokenId = this.provider.tokenSet.resolveTokenId(forcedExit.token);
            const transactionData = {
                initiatorAccountId: this.accountId,
                target: forcedExit.target,
                tokenId,
                fee: forcedExit.fee,
                nonce: forcedExit.nonce,
                validFrom: forcedExit.validFrom || 0,
                validUntil: forcedExit.validUntil || utils_1.MAX_TIMESTAMP
            };
            return yield this.signer.signSyncForcedExit(transactionData);
        });
    }
    getSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for swapping funds');
            }
            yield this.setRequiredAccountIdFromServer('Swap submission');
            const feeToken = this.provider.tokenSet.resolveTokenId(swap.feeToken);
            return this.signer.signSyncSwap(Object.assign(Object.assign({}, swap), { submitterId: yield this.getAccountId(), submitterAddress: this.address(), feeToken }));
        });
    }
    getMintNFT(mintNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            yield this.setRequiredAccountIdFromServer('MintNFT');
            const feeTokenId = this.provider.tokenSet.resolveTokenId(mintNFT.feeToken);
            const transactionData = {
                creatorId: this.accountId,
                creatorAddress: this.address(),
                recipient: mintNFT.recipient,
                contentHash: mintNFT.contentHash,
                feeTokenId,
                fee: mintNFT.fee,
                nonce: mintNFT.nonce
            };
            return yield this.signer.signMintNFT(transactionData);
        });
    }
    getWithdrawNFT(withdrawNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for sending Rollup transactions.');
            }
            yield this.setRequiredAccountIdFromServer('WithdrawNFT');
            const tokenId = this.provider.tokenSet.resolveTokenId(withdrawNFT.token);
            const feeTokenId = this.provider.tokenSet.resolveTokenId(withdrawNFT.feeToken);
            const transactionData = {
                accountId: this.accountId,
                from: this.address(),
                to: withdrawNFT.to,
                tokenId,
                feeTokenId,
                fee: withdrawNFT.fee,
                nonce: withdrawNFT.nonce,
                validFrom: withdrawNFT.validFrom,
                validUntil: withdrawNFT.validUntil
            };
            return yield this.signer.signWithdrawNFT(transactionData);
        });
    }
    getWithdrawNFTEthMessagePart(withdrawNFT) {
        const stringFee = ethers_1.BigNumber.from(withdrawNFT.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(withdrawNFT.feeToken, withdrawNFT.fee);
        const stringFeeToken = this.provider.tokenSet.resolveTokenSymbol(withdrawNFT.feeToken);
        return this.ethMessageSigner().getWithdrawNFTEthMessagePart({
            token: withdrawNFT.token,
            to: withdrawNFT.to,
            stringFee,
            stringFeeToken
        });
    }
    // The following methods are needed in case user decided to build
    // a message for the batch himself (e.g. in case of multi-authors batch).
    // It might seem that these belong to ethMessageSigner, however, we have
    // to resolve the token and format amount/fee before constructing the
    // transaction.
    getTransferEthMessagePart(transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const stringAmount = ethers_1.BigNumber.from(transfer.amount).isZero()
                ? null
                : this.provider.tokenSet.formatToken(transfer.token, transfer.amount);
            const stringFee = ethers_1.BigNumber.from(transfer.fee).isZero()
                ? null
                : this.provider.tokenSet.formatToken(transfer.token, transfer.fee);
            const stringToken = yield this.provider.getTokenSymbol(transfer.token);
            return this.ethMessageSigner().getTransferEthMessagePart({
                stringAmount,
                stringFee,
                stringToken,
                to: transfer.to
            });
        });
    }
    getWithdrawEthMessagePart(withdraw) {
        const stringAmount = ethers_1.BigNumber.from(withdraw.amount).isZero()
            ? null
            : this.provider.tokenSet.formatToken(withdraw.token, withdraw.amount);
        const stringFee = ethers_1.BigNumber.from(withdraw.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(withdraw.token, withdraw.fee);
        const stringToken = this.provider.tokenSet.resolveTokenSymbol(withdraw.token);
        return this.ethMessageSigner().getWithdrawEthMessagePart({
            stringAmount,
            stringFee,
            stringToken,
            ethAddress: withdraw.ethAddress
        });
    }
    getChangePubKeyEthMessagePart(changePubKey) {
        const stringFee = ethers_1.BigNumber.from(changePubKey.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(changePubKey.feeToken, changePubKey.fee);
        const stringToken = this.provider.tokenSet.resolveTokenSymbol(changePubKey.feeToken);
        return this.ethMessageSigner().getChangePubKeyEthMessagePart({
            pubKeyHash: changePubKey.pubKeyHash,
            stringToken,
            stringFee
        });
    }
    getMintNFTEthMessagePart(mintNFT) {
        const stringFee = ethers_1.BigNumber.from(mintNFT.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(mintNFT.feeToken, mintNFT.fee);
        const stringFeeToken = this.provider.tokenSet.resolveTokenSymbol(mintNFT.feeToken);
        return this.ethMessageSigner().getMintNFTEthMessagePart({
            stringFeeToken,
            stringFee,
            recipient: mintNFT.recipient,
            contentHash: mintNFT.contentHash
        });
    }
    getSwapEthSignMessagePart(swap) {
        const stringFee = ethers_1.BigNumber.from(swap.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(swap.feeToken, swap.fee);
        const stringToken = this.provider.tokenSet.resolveTokenSymbol(swap.feeToken);
        return this.ethMessageSigner().getSwapEthSignMessagePart({
            fee: stringFee,
            feeToken: stringToken
        });
    }
    getForcedExitEthMessagePart(forcedExit) {
        const stringFee = ethers_1.BigNumber.from(forcedExit.fee).isZero()
            ? null
            : this.provider.tokenSet.formatToken(forcedExit.token, forcedExit.fee);
        const stringToken = this.provider.tokenSet.resolveTokenSymbol(forcedExit.token);
        return this.ethMessageSigner().getForcedExitEthMessagePart({
            stringToken,
            stringFee,
            target: forcedExit.target
        });
    }
    getPartialOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signer) {
                throw new Error('Rollup signer is required for signing an order');
            }
            yield this.setRequiredAccountIdFromServer('Swap order');
            const nonce = order.nonce != null ? yield this.getNonce(order.nonce) : yield this.getNonce();
            const recipient = order.recipient || this.address();
            let ratio;
            const sell = order.tokenSell;
            const buy = order.tokenBuy;
            if (!order.ratio[sell] || !order.ratio[buy]) {
                throw new Error(`Wrong tokens in the ratio object: should be ${sell} and ${buy}`);
            }
            if (order.ratio.type == 'Wei') {
                ratio = [order.ratio[sell], order.ratio[buy]];
            }
            else if (order.ratio.type == 'Token') {
                ratio = [
                    this.provider.tokenSet.parseToken(sell, order.ratio[sell].toString()),
                    this.provider.tokenSet.parseToken(buy, order.ratio[buy].toString())
                ];
            }
            const partialOrder = yield this.signer.signSyncOrder({
                accountId: this.accountId,
                recipient,
                nonce,
                amount: order.amount || ethers_1.BigNumber.from(0),
                tokenSell: this.provider.tokenSet.resolveTokenId(order.tokenSell),
                tokenBuy: this.provider.tokenSet.resolveTokenId(order.tokenBuy),
                validFrom: order.validFrom || 0,
                validUntil: order.validUntil || utils_1.MAX_TIMESTAMP,
                ratio
            });
            return partialOrder;
        });
    }
}
exports.Wallet = Wallet;
