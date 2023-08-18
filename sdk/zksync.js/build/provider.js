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
exports.ETHProxy = exports.Provider = exports.getDefaultProvider = void 0;
const transport_1 = require("./transport");
const ethers_1 = require("ethers");
const utils_1 = require("./utils");
const typechain_1 = require("./typechain");
const provider_interface_1 = require("./provider-interface");
function getDefaultProvider(network, transport = 'HTTP', pollIntervalMilliSecs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (transport === 'WS') {
            console.warn('Websocket support will be removed in future. Use HTTP transport instead.');
        }
        if (network === 'localhost') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('ws://127.0.0.1:3031', network);
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('http://127.0.0.1:3030', pollIntervalMilliSecs, network);
            }
        }
        else if (network === 'testnet') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://dev.aggregation.rifcomputing.net:3031');
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://dev.aggregation.rifcomputing.net:3030', pollIntervalMilliSecs);
            }
        }
        else if (network === 'mainnet') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://aggregation.rifcomputing.net:3031');
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://aggregation.rifcomputing.net:3030', pollIntervalMilliSecs);
            }
        }
        else if (network === 'goerli') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://goerli-api.zksync.io/jsrpc-ws', network);
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://goerli-api.zksync.io/jsrpc', pollIntervalMilliSecs, network);
            }
        }
        else if (network === 'goerli-beta') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://goerli-beta-api.zksync.dev/jsrpc-ws', network);
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://goerli-beta-api.zksync.dev/jsrpc', pollIntervalMilliSecs, network);
            }
        }
        else if (network === 'rinkeby-beta') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://rinkeby-beta-api.zksync.io/jsrpc-ws', network);
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://rinkeby-beta-api.zksync.io/jsrpc', pollIntervalMilliSecs, network);
            }
        }
        else if (network === 'mainnet-zk') {
            if (transport === 'WS') {
                return yield Provider.newWebsocketProvider('wss://api.zksync.io/jsrpc-ws', network);
            }
            else if (transport === 'HTTP') {
                return yield Provider.newHttpProvider('https://api.zksync.io/jsrpc', pollIntervalMilliSecs, network);
            }
        }
        else {
            throw new Error(`Rootstock network ${network} is not supported`);
        }
    });
}
exports.getDefaultProvider = getDefaultProvider;
class Provider extends provider_interface_1.SyncProvider {
    constructor(transport) {
        super();
        this.transport = transport;
        this.providerType = 'RPC';
    }
    /**
     * @deprecated Websocket support will be removed in future. Use HTTP transport instead.
     */
    static newWebsocketProvider(address, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = yield transport_1.WSTransport.connect(address);
            const provider = new Provider(transport);
            const contractsAndTokens = yield Promise.all([provider.getContractAddress(), provider.getTokens()]);
            provider.contractAddress = contractsAndTokens[0];
            provider.tokenSet = new utils_1.TokenSet(contractsAndTokens[1]);
            provider.network = network;
            return provider;
        });
    }
    static newHttpProvider(address = 'http://127.0.0.1:3030', pollIntervalMilliSecs, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new transport_1.HTTPTransport(address);
            const provider = new Provider(transport);
            if (pollIntervalMilliSecs) {
                provider.pollIntervalMilliSecs = pollIntervalMilliSecs;
            }
            const contractsAndTokens = yield Promise.all([provider.getContractAddress(), provider.getTokens()]);
            provider.contractAddress = contractsAndTokens[0];
            provider.tokenSet = new utils_1.TokenSet(contractsAndTokens[1]);
            provider.network = network;
            return provider;
        });
    }
    /**
     * Provides some hardcoded values the `Provider` responsible for
     * without communicating with the network
     */
    static newMockProvider(network, ethPrivateKey, getTokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new transport_1.DummyTransport(network, ethPrivateKey, getTokens);
            const provider = new Provider(transport);
            const contractsAndTokens = yield Promise.all([provider.getContractAddress(), provider.getTokens()]);
            provider.contractAddress = contractsAndTokens[0];
            provider.tokenSet = new utils_1.TokenSet(contractsAndTokens[1]);
            provider.network = network;
            return provider;
        });
    }
    // return transaction hash (e.g. sync-tx:dead..beef)
    submitTx(tx, signature, fastProcessing) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('tx_submit', [tx, signature, fastProcessing]);
        });
    }
    // Requests `zkSync` server to execute several transactions together.
    // return transaction hash (e.g. sync-tx:dead..beef)
    submitTxsBatch(transactions, ethSignatures) {
        return __awaiter(this, void 0, void 0, function* () {
            let signatures = [];
            // For backwards compatibility we allow sending single signature as well
            // as no signatures at all.
            if (ethSignatures == undefined) {
                signatures = [];
            }
            else if (ethSignatures instanceof Array) {
                signatures = ethSignatures;
            }
            else {
                signatures.push(ethSignatures);
            }
            return yield this.transport.request('submit_txs_batch', [transactions, signatures]);
        });
    }
    getContractAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('contract_address', null);
        });
    }
    getTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('tokens', null);
        });
    }
    getState(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('account_info', [address]);
        });
    }
    // get transaction status by its hash (e.g. 0xdead..beef)
    getTxReceipt(txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('tx_info', [txHash]);
        });
    }
    getPriorityOpStatus(serialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('ethop_info', [serialId]);
        });
    }
    getConfirmationsForEthOpAmount() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('get_confirmations_for_eth_op_amount', []);
        });
    }
    getEthTxForWithdrawal(withdrawal_hash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('get_eth_tx_for_withdrawal', [withdrawal_hash]);
        });
    }
    getNFT(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const nft = yield this.transport.request('get_nft', [id]);
            // If the NFT does not exist, throw an exception
            if (nft == null) {
                throw new Error(`Requested NFT doesn't exist or the corresponding mintNFT operation is not verified yet`);
            }
            return nft;
        });
    }
    getNFTOwner(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('get_nft_owner', [id]);
        });
    }
    notifyPriorityOp(serialId, action) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.transport.subscriptionsSupported()) {
                return yield new Promise((resolve) => {
                    const subscribe = this.transport.subscribe('ethop_subscribe', [serialId, action], 'ethop_unsubscribe', (resp) => {
                        subscribe
                            .then((sub) => sub.unsubscribe())
                            .catch((err) => console.log(`WebSocket connection closed with reason: ${err}`));
                        resolve(resp);
                    });
                });
            }
            else {
                while (true) {
                    const priorOpStatus = yield this.getPriorityOpStatus(serialId);
                    const notifyDone = action === 'COMMIT'
                        ? priorOpStatus.block && priorOpStatus.block.committed
                        : priorOpStatus.block && priorOpStatus.block.verified;
                    if (notifyDone) {
                        return priorOpStatus;
                    }
                    else {
                        yield (0, utils_1.sleep)(this.pollIntervalMilliSecs);
                    }
                }
            }
        });
    }
    notifyTransaction(hash, action) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.transport.subscriptionsSupported()) {
                return yield new Promise((resolve) => {
                    const subscribe = this.transport.subscribe('tx_subscribe', [hash, action], 'tx_unsubscribe', (resp) => {
                        subscribe
                            .then((sub) => sub.unsubscribe())
                            .catch((err) => console.log(`WebSocket connection closed with reason: ${err}`));
                        resolve(resp);
                    });
                });
            }
            else {
                while (true) {
                    const transactionStatus = yield this.getTxReceipt(hash);
                    const notifyDone = action == 'COMMIT'
                        ? transactionStatus.block && transactionStatus.block.committed
                        : transactionStatus.block && transactionStatus.block.verified;
                    if (notifyDone) {
                        return transactionStatus;
                    }
                    else {
                        yield (0, utils_1.sleep)(this.pollIntervalMilliSecs);
                    }
                }
            }
        });
    }
    getTransactionFee(txType, address, tokenLike) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionFee = yield this.transport.request('get_tx_fee', [txType, address.toString(), tokenLike]);
            return {
                feeType: transactionFee.feeType,
                gasTxAmount: ethers_1.BigNumber.from(transactionFee.gasTxAmount),
                gasPriceWei: ethers_1.BigNumber.from(transactionFee.gasPriceWei),
                gasFee: ethers_1.BigNumber.from(transactionFee.gasFee),
                zkpFee: ethers_1.BigNumber.from(transactionFee.zkpFee),
                totalFee: ethers_1.BigNumber.from(transactionFee.totalFee)
            };
        });
    }
    getTransactionsBatchFee(txTypes, addresses, tokenLike) {
        return __awaiter(this, void 0, void 0, function* () {
            const batchFee = yield this.transport.request('get_txs_batch_fee_in_wei', [txTypes, addresses, tokenLike]);
            return ethers_1.BigNumber.from(batchFee.totalFee);
        });
    }
    getTokenPrice(tokenLike) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenPrice = yield this.transport.request('get_token_price', [tokenLike]);
            return parseFloat(tokenPrice);
        });
    }
    toggle2FA(toggle2FA) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.transport.request('toggle_2fa', [toggle2FA]);
            return result.success;
        });
    }
    getNFTIdByTxHash(txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.request('get_nft_id_by_tx_hash', [txHash]);
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.transport.disconnect();
        });
    }
}
exports.Provider = Provider;
class ETHProxy {
    constructor(ethersProvider, contractAddress) {
        this.ethersProvider = ethersProvider;
        this.contractAddress = contractAddress;
        this.dummySigner = new ethers_1.ethers.VoidSigner(ethers_1.ethers.constants.AddressZero, this.ethersProvider);
        const governanceFactory = new typechain_1.GovernanceFactory(this.dummySigner);
        this.governanceContract = governanceFactory.attach(contractAddress.govContract);
        const zkSyncFactory = new typechain_1.ZkSyncFactory(this.dummySigner);
        this.zkSyncContract = zkSyncFactory.attach(contractAddress.mainContract);
    }
    getGovernanceContract() {
        return this.governanceContract;
    }
    getZkSyncContract() {
        return this.zkSyncContract;
    }
    // This method is very helpful for those who have already fetched the
    // default factory and want to avoid asynchorouns execution from now on
    getCachedNFTDefaultFactory() {
        return this.zksyncNFTFactory;
    }
    getDefaultNFTFactory() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.zksyncNFTFactory) {
                return this.zksyncNFTFactory;
            }
            const nftFactoryAddress = yield this.governanceContract.defaultFactory();
            const nftFactory = new typechain_1.ZkSyncNFTFactoryFactory(this.dummySigner);
            this.zksyncNFTFactory = nftFactory.attach(nftFactoryAddress);
            return this.zksyncNFTFactory;
        });
    }
    resolveTokenId(token) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, utils_1.isTokenRBTC)(token)) {
                return 0;
            }
            else {
                const tokenId = yield this.governanceContract.tokenIds(token);
                if (tokenId == 0) {
                    throw new Error(`ERC20 token ${token} is not supported`);
                }
                return tokenId;
            }
        });
    }
}
exports.ETHProxy = ETHProxy;
