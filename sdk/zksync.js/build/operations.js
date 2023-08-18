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
exports.submitSignedTransactionsBatch = exports.submitSignedTransaction = exports.Transaction = exports.ETHOperation = exports.ZKSyncTxError = void 0;
const utils_1 = require("./utils");
class ZKSyncTxError extends Error {
    constructor(message, value) {
        super(message);
        this.value = value;
    }
}
exports.ZKSyncTxError = ZKSyncTxError;
class ETHOperation {
    constructor(ethTx, zkSyncProvider) {
        this.ethTx = ethTx;
        this.zkSyncProvider = zkSyncProvider;
        this.state = 'Sent';
    }
    awaitEthereumTxCommit() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== 'Sent')
                return;
            const txReceipt = yield this.ethTx.wait();
            for (const log of txReceipt.logs) {
                try {
                    const priorityQueueLog = utils_1.SYNC_MAIN_CONTRACT_INTERFACE.parseLog(log);
                    if (priorityQueueLog && priorityQueueLog.args.serialId != null) {
                        this.priorityOpId = priorityQueueLog.args.serialId;
                    }
                }
                catch (_a) { }
            }
            if (!this.priorityOpId) {
                throw new Error('Failed to parse tx logs');
            }
            this.state = 'Mined';
            return txReceipt;
        });
    }
    awaitReceipt() {
        return __awaiter(this, void 0, void 0, function* () {
            this.throwErrorIfFailedState();
            yield this.awaitEthereumTxCommit();
            if (this.state !== 'Mined')
                return;
            let query;
            if (this.zkSyncProvider.providerType === 'RPC') {
                query = this.priorityOpId.toNumber();
            }
            else {
                query = this.ethTx.hash;
            }
            const receipt = yield this.zkSyncProvider.notifyPriorityOp(query, 'COMMIT');
            if (!receipt.executed) {
                this.setErrorState(new ZKSyncTxError('Priority operation failed', receipt));
                this.throwErrorIfFailedState();
            }
            this.state = 'Committed';
            return receipt;
        });
    }
    awaitVerifyReceipt() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.awaitReceipt();
            if (this.state !== 'Committed')
                return;
            let query;
            if (this.zkSyncProvider.providerType === 'RPC') {
                query = this.priorityOpId.toNumber();
            }
            else {
                query = this.ethTx.hash;
            }
            const receipt = yield this.zkSyncProvider.notifyPriorityOp(query, 'VERIFY');
            this.state = 'Verified';
            return receipt;
        });
    }
    setErrorState(error) {
        this.state = 'Failed';
        this.error = error;
    }
    throwErrorIfFailedState() {
        if (this.state === 'Failed')
            throw this.error;
    }
}
exports.ETHOperation = ETHOperation;
class Transaction {
    constructor(txData, txHash, sidechainProvider) {
        this.txData = txData;
        this.txHash = txHash;
        this.sidechainProvider = sidechainProvider;
        this.state = 'Sent';
    }
    awaitReceipt() {
        return __awaiter(this, void 0, void 0, function* () {
            this.throwErrorIfFailedState();
            if (this.state !== 'Sent')
                return;
            const receipt = yield this.sidechainProvider.notifyTransaction(this.txHash, 'COMMIT');
            if (!receipt.success) {
                this.setErrorState(new ZKSyncTxError(`Rollup transaction failed: ${receipt.failReason}`, receipt));
                this.throwErrorIfFailedState();
            }
            this.state = 'Committed';
            return receipt;
        });
    }
    awaitVerifyReceipt() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.awaitReceipt();
            const receipt = yield this.sidechainProvider.notifyTransaction(this.txHash, 'VERIFY');
            this.state = 'Verified';
            return receipt;
        });
    }
    setErrorState(error) {
        this.state = 'Failed';
        this.error = error;
    }
    throwErrorIfFailedState() {
        if (this.state === 'Failed')
            throw this.error;
    }
}
exports.Transaction = Transaction;
function submitSignedTransaction(signedTx, provider, fastProcessing) {
    return __awaiter(this, void 0, void 0, function* () {
        const transactionHash = yield provider.submitTx(signedTx.tx, signedTx.ethereumSignature, fastProcessing);
        return new Transaction(signedTx, transactionHash, provider);
    });
}
exports.submitSignedTransaction = submitSignedTransaction;
function submitSignedTransactionsBatch(provider, signedTxs, ethSignatures) {
    return __awaiter(this, void 0, void 0, function* () {
        const transactionHashes = yield provider.submitTxsBatch(signedTxs.map((tx) => {
            return { tx: tx.tx, signature: tx.ethereumSignature };
        }), ethSignatures);
        return transactionHashes.map((txHash, idx) => new Transaction(signedTxs[idx], txHash, provider));
    });
}
exports.submitSignedTransactionsBatch = submitSignedTransactionsBatch;
