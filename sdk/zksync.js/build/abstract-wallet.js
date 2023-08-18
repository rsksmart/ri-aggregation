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
exports.AbstractWallet = void 0;
const ethers_1 = require("ethers");
const logger_1 = require("@ethersproject/logger");
const batch_builder_1 = require("./batch-builder");
const types_1 = require("./types");
const utils_1 = require("./utils");
const operations_1 = require("./operations");
class AbstractWallet {
    constructor(cachedAddress, accountId) {
        this.cachedAddress = cachedAddress;
        this.accountId = accountId;
    }
    connect(provider) {
        this.provider = provider;
        return this;
    }
    // *************
    // Basic getters
    //
    address() {
        return this.cachedAddress;
    }
    getCurrentPubKeyHash() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.provider.getState(this.address())).committed.pubKeyHash;
        });
    }
    getNonce(nonce = 'committed') {
        return __awaiter(this, void 0, void 0, function* () {
            if (nonce === 'committed') {
                return (yield this.provider.getState(this.address())).committed.nonce;
            }
            else if (typeof nonce === 'number') {
                return nonce;
            }
        });
    }
    getAccountId() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getAccountState()).id;
        });
    }
    getAccountState() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.provider.getState(this.address());
        });
    }
    resolveAccountId() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.accountId !== undefined) {
                return this.accountId;
            }
            else {
                const accountState = yield this.getAccountState();
                if (!accountState.id) {
                    throw new Error("Can't resolve account id from the Rootstock node");
                }
                return accountState.id;
            }
        });
    }
    isCorrespondingSigningKeySet() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.syncSignerConnected()) {
                throw new Error('Rollup signer is required for current pubkey calculation.');
            }
            const currentPubKeyHash = yield this.getCurrentPubKeyHash();
            const signerPubKeyHash = yield this.syncSignerPubKeyHash();
            return currentPubKeyHash === signerPubKeyHash;
        });
    }
    isSigningKeySet() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.syncSignerConnected()) {
                throw new Error('Rollup signer is required for current pubkey calculation.');
            }
            const currentPubKeyHash = yield this.getCurrentPubKeyHash();
            const zeroPubKeyHash = 'sync:0000000000000000000000000000000000000000';
            return zeroPubKeyHash !== currentPubKeyHash;
        });
    }
    getNFT(tokenId, type = 'committed') {
        return __awaiter(this, void 0, void 0, function* () {
            const accountState = yield this.getAccountState();
            let token;
            if (type === 'committed') {
                token = accountState.committed.nfts[tokenId];
            }
            else {
                token = accountState.verified.nfts[tokenId];
            }
            return token;
        });
    }
    getBalance(token, type = 'committed') {
        return __awaiter(this, void 0, void 0, function* () {
            const accountState = yield this.getAccountState();
            const tokenSymbol = this.provider.tokenSet.resolveTokenSymbol(token);
            let balance;
            if (type === 'committed') {
                balance = accountState.committed.balances[tokenSymbol] || '0';
            }
            else {
                balance = accountState.verified.balances[tokenSymbol] || '0';
            }
            return ethers_1.BigNumber.from(balance);
        });
    }
    getEthereumBalance(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield (0, utils_1.getEthereumBalance)(this.ethSigner().provider, this.provider, this.cachedAddress, token);
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    // *********************
    // Batch builder methods
    //
    /**
     * Creates a batch builder instance.
     *
     * @param nonce Nonce that should be used as the nonce of the first transaction in the batch.
     * @returns Batch builder object
     */
    batchBuilder(nonce) {
        return batch_builder_1.BatchBuilder.fromWallet(this, nonce);
    }
    // Swap part
    signLimitOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.signOrder(Object.assign(Object.assign({}, order), { amount: 0 }));
        });
    }
    // Toggle 2FA part
    getToggle2FA(enable, pubKeyHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountId = yield this.getAccountId();
            const timestamp = new Date().getTime();
            const signature = yield this.ethMessageSigner().getEthMessageSignature((0, utils_1.getToggle2FAMessage)(enable, timestamp, pubKeyHash));
            return {
                accountId,
                signature,
                timestamp,
                enable,
                pubKeyHash
            };
        });
    }
    toggle2FA(enable, pubKeyHash) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setRequiredAccountIdFromServer('Toggle 2FA');
            return yield this.provider.toggle2FA(yield this.getToggle2FA(enable, pubKeyHash));
        });
    }
    // *************
    // L1 operations
    //
    // Priority operations, ones that sent through Rootstock.
    //
    approveERC20TokenDeposits(token, max_erc20_approve_amount = utils_1.MAX_ERC20_APPROVE_AMOUNT) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, utils_1.isTokenRBTC)(token)) {
                throw Error('RBTC token does not need approval.');
            }
            const tokenAddress = this.provider.tokenSet.resolveTokenAddress(token);
            const erc20contract = new ethers_1.Contract(tokenAddress, utils_1.IERC20_INTERFACE, this.ethSigner());
            try {
                return erc20contract.approve(this.provider.contractAddress.mainContract, max_erc20_approve_amount);
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    depositToSyncFromEthereum(deposit) {
        return __awaiter(this, void 0, void 0, function* () {
            const gasPrice = yield this.ethSigner().provider.getGasPrice();
            const mainZkSyncContract = this.getZkSyncMainContract();
            let ethTransaction;
            if ((0, utils_1.isTokenRBTC)(deposit.token)) {
                try {
                    ethTransaction = yield mainZkSyncContract.depositRBTC(deposit.depositTo, Object.assign({ value: ethers_1.BigNumber.from(deposit.amount), gasLimit: ethers_1.BigNumber.from(utils_1.RBTC_RECOMMENDED_DEPOSIT_GAS_LIMIT), gasPrice }, deposit.ethTxOptions));
                }
                catch (e) {
                    this.modifyEthersError(e);
                }
            }
            else {
                const tokenAddress = this.provider.tokenSet.resolveTokenAddress(deposit.token);
                // ERC20 token deposit
                const erc20contract = new ethers_1.Contract(tokenAddress, utils_1.IERC20_INTERFACE, this.ethSigner());
                let nonce;
                if (deposit.approveDepositAmountForERC20) {
                    try {
                        const approveTx = yield erc20contract.approve(this.provider.contractAddress.mainContract, deposit.amount);
                        nonce = approveTx.nonce + 1;
                    }
                    catch (e) {
                        this.modifyEthersError(e);
                    }
                }
                const args = [
                    tokenAddress,
                    deposit.amount,
                    deposit.depositTo,
                    Object.assign({ nonce,
                        gasPrice }, deposit.ethTxOptions)
                ];
                // We set gas limit only if user does not set it using ethTxOptions.
                const txRequest = args[args.length - 1];
                if (txRequest.gasLimit == null) {
                    try {
                        const gasEstimate = yield mainZkSyncContract.estimateGas.depositERC20(...args).then((estimate) => estimate, () => ethers_1.BigNumber.from('0'));
                        const isMainnet = (yield this.ethSigner().getChainId()) == 1;
                        let recommendedGasLimit = isMainnet && utils_1.ERC20_DEPOSIT_GAS_LIMIT[tokenAddress]
                            ? ethers_1.BigNumber.from(utils_1.ERC20_DEPOSIT_GAS_LIMIT[tokenAddress])
                            : utils_1.ERC20_RECOMMENDED_DEPOSIT_GAS_LIMIT;
                        txRequest.gasLimit = gasEstimate.gte(recommendedGasLimit) ? gasEstimate : recommendedGasLimit;
                        args[args.length - 1] = txRequest;
                    }
                    catch (e) {
                        this.modifyEthersError(e);
                    }
                }
                try {
                    ethTransaction = yield mainZkSyncContract.depositERC20(...args);
                }
                catch (e) {
                    this.modifyEthersError(e);
                }
            }
            return new operations_1.ETHOperation(ethTransaction, this.provider);
        });
    }
    onchainAuthSigningKey(nonce = 'committed', ethTxOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.syncSignerConnected()) {
                throw new Error('Rollup signer is required for current pubkey calculation.');
            }
            const currentPubKeyHash = yield this.getCurrentPubKeyHash();
            const newPubKeyHash = yield this.syncSignerPubKeyHash();
            if (currentPubKeyHash === newPubKeyHash) {
                throw new Error('Current PubKeyHash is the same as new');
            }
            const numNonce = yield this.getNonce(nonce);
            const mainZkSyncContract = this.getZkSyncMainContract();
            try {
                return mainZkSyncContract.setAuthPubkeyHash(newPubKeyHash.replace('sync:', '0x'), numNonce, Object.assign({ gasLimit: ethers_1.BigNumber.from('200000') }, ethTxOptions));
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    emergencyWithdraw(withdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            const gasPrice = yield this.ethSigner().provider.getGasPrice();
            let accountId = withdraw.accountId != null ? withdraw.accountId : yield this.resolveAccountId();
            const mainZkSyncContract = this.getZkSyncMainContract();
            const tokenAddress = this.provider.tokenSet.resolveTokenAddress(withdraw.token);
            try {
                const ethTransaction = yield mainZkSyncContract.requestFullExit(accountId, tokenAddress, Object.assign({ gasLimit: ethers_1.BigNumber.from('500000'), gasPrice }, withdraw.ethTxOptions));
                return new operations_1.ETHOperation(ethTransaction, this.provider);
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    emergencyWithdrawNFT(withdrawNFT) {
        return __awaiter(this, void 0, void 0, function* () {
            const gasPrice = yield this.ethSigner().provider.getGasPrice();
            let accountId = withdrawNFT.accountId != null ? withdrawNFT.accountId : yield this.resolveAccountId();
            const mainZkSyncContract = this.getZkSyncMainContract();
            try {
                const ethTransaction = yield mainZkSyncContract.requestFullExitNFT(accountId, withdrawNFT.tokenId, Object.assign({ gasLimit: ethers_1.BigNumber.from('500000'), gasPrice }, withdrawNFT.ethTxOptions));
                return new operations_1.ETHOperation(ethTransaction, this.provider);
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    signRegisterFactory(factoryAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setRequiredAccountIdFromServer('Sign register factory');
            const signature = yield this.ethMessageSigner().ethSignRegisterFactoryMessage(factoryAddress, this.accountId, this.address());
            return {
                signature,
                accountId: this.accountId,
                accountAddress: this.address()
            };
        });
    }
    // **********
    // L1 getters
    //
    // Getter methods that query information from Web3.
    //
    isOnchainAuthSigningKeySet(nonce = 'committed') {
        return __awaiter(this, void 0, void 0, function* () {
            const mainZkSyncContract = this.getZkSyncMainContract();
            const numNonce = yield this.getNonce(nonce);
            try {
                const onchainAuthFact = yield mainZkSyncContract.authFacts(this.address(), numNonce);
                return onchainAuthFact !== '0x0000000000000000000000000000000000000000000000000000000000000000';
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    isERC20DepositsApproved(token, erc20ApproveThreshold = utils_1.ERC20_APPROVE_TRESHOLD) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, utils_1.isTokenRBTC)(token)) {
                throw Error('RBTC token does not need approval.');
            }
            const tokenAddress = this.provider.tokenSet.resolveTokenAddress(token);
            const erc20contract = new ethers_1.Contract(tokenAddress, utils_1.IERC20_INTERFACE, this.ethSigner());
            try {
                const currentAllowance = yield erc20contract.allowance(this.address(), this.provider.contractAddress.mainContract);
                return ethers_1.BigNumber.from(currentAllowance).gte(erc20ApproveThreshold);
            }
            catch (e) {
                this.modifyEthersError(e);
            }
        });
    }
    getZkSyncMainContract() {
        return new ethers_1.ethers.Contract(this.provider.contractAddress.mainContract, utils_1.SYNC_MAIN_CONTRACT_INTERFACE, this.ethSigner());
    }
    // ****************
    // Internal methods
    //
    verifyNetworks() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.provider.network != undefined && this.ethSigner().provider != undefined) {
                const ethNetwork = yield this.ethSigner().provider.getNetwork();
                if ((0, types_1.l1ChainId)(this.provider.network) !== ethNetwork.chainId) {
                    throw new Error(`RSK network ${ethNetwork.name} and ZkSync network ${this.provider.network} don't match`);
                }
            }
        });
    }
    modifyEthersError(error) {
        if (this.ethSigner instanceof ethers_1.ethers.providers.JsonRpcSigner) {
            // List of errors that can be caused by user's actions, which have to be forwarded as-is.
            const correct_errors = [
                logger_1.ErrorCode.NONCE_EXPIRED,
                logger_1.ErrorCode.INSUFFICIENT_FUNDS,
                logger_1.ErrorCode.REPLACEMENT_UNDERPRICED,
                logger_1.ErrorCode.UNPREDICTABLE_GAS_LIMIT
            ];
            if (!correct_errors.includes(error.code)) {
                // This is an error which we don't expect
                error.message = `Rootstock smart wallet JSON RPC server returned the following error while executing an operation: "${error.message}". Please contact your smart wallet support for help.`;
            }
        }
        throw error;
    }
    setRequiredAccountIdFromServer(actionName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.accountId === undefined) {
                const accountIdFromServer = yield this.getAccountId();
                if (accountIdFromServer == null) {
                    throw new Error(`Failed to ${actionName}: Account does not exist in the zkSync network`);
                }
                else {
                    this.accountId = accountIdFromServer;
                }
            }
        });
    }
}
exports.AbstractWallet = AbstractWallet;
