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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummyTransport = exports.WSTransport = exports.HTTPTransport = exports.JRPCError = exports.AbstractJSONRPCTransport = void 0;
const ethers_1 = require("ethers");
const ethers = __importStar(require("ethers"));
const axios_1 = __importDefault(require("axios"));
const WebSocketAsPromised = require("websocket-as-promised");
const websocket = __importStar(require("websocket"));
const signer_1 = require("./signer");
const W3CWebSocket = websocket.w3cwebsocket;
class AbstractJSONRPCTransport {
    subscriptionsSupported() {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe(subMethod, subParams, unsubMethod, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('subscription are not supported for this transport');
        });
    }
}
exports.AbstractJSONRPCTransport = AbstractJSONRPCTransport;
// Has jrpcError field which is JRPC error object.
// https://www.jsonrpc.org/specification#error_object
class JRPCError extends Error {
    constructor(message, jrpcError) {
        super(message);
        this.jrpcError = jrpcError;
    }
}
exports.JRPCError = JRPCError;
class Subscription {
    constructor(unsubscribe) {
        this.unsubscribe = unsubscribe;
    }
}
class HTTPTransport extends AbstractJSONRPCTransport {
    constructor(address) {
        super();
        this.address = address;
    }
    // JSON RPC request
    request(method, params = null, config) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = {
                id: 1,
                jsonrpc: '2.0',
                method,
                params
            };
            const response = yield axios_1.default.post(this.address, request, config).then((resp) => {
                return resp.data;
            });
            if ('result' in response) {
                return response.result;
            }
            else if ('error' in response) {
                throw new JRPCError(`Rollup API response error: code ${response.error.code}; message: ${response.error.message}`, response.error);
            }
            else {
                throw new Error('Unknown JRPC Error');
            }
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}
exports.HTTPTransport = HTTPTransport;
/**
 * @deprecated Websocket support will be removed in future. Use HTTP transport instead.
 */
class WSTransport extends AbstractJSONRPCTransport {
    constructor(address) {
        super();
        this.address = address;
        this.ws = new WebSocketAsPromised(address, {
            createWebSocket: (url) => new W3CWebSocket(url),
            packMessage: (data) => JSON.stringify(data),
            unpackMessage: (data) => JSON.parse(data),
            attachRequestId: (data, requestId) => Object.assign({ id: requestId }, data),
            extractRequestId: (data) => data && data.id
        });
        this.subscriptionCallback = new Map();
        // Call all subscription callbacks
        this.ws.onUnpackedMessage.addListener((data) => {
            if (data.params && data.params.subscription) {
                const params = data.params;
                if (this.subscriptionCallback.has(params.subscription)) {
                    this.subscriptionCallback.get(params.subscription)(params.result);
                }
            }
        });
    }
    static connect(address = 'ws://127.0.0.1:3031') {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new WSTransport(address);
            yield transport.ws.open();
            return transport;
        });
    }
    subscriptionsSupported() {
        return true;
    }
    subscribe(subMethod, subParams, unsubMethod, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const req = { jsonrpc: '2.0', method: subMethod, params: subParams };
            const sub = yield this.ws.sendRequest(req);
            if (sub.error) {
                throw new JRPCError('Subscription failed', sub.error);
            }
            const subId = sub.result;
            this.subscriptionCallback.set(subId, cb);
            const unsubscribe = () => __awaiter(this, void 0, void 0, function* () {
                const unsubRep = yield this.ws.sendRequest({
                    jsonrpc: '2.0',
                    method: unsubMethod,
                    params: [subId]
                });
                if (unsubRep.error) {
                    throw new JRPCError(`Unsubscribe failed: ${subId}, ${JSON.stringify(unsubRep.error)}`, unsubRep.error);
                }
                if (unsubRep.result !== true) {
                    throw new Error(`Unsubscription failed, returned false: ${subId}`);
                }
                this.subscriptionCallback.delete(subId);
            });
            return new Subscription(unsubscribe);
        });
    }
    // JSON RPC request
    request(method, params = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = {
                jsonrpc: '2.0',
                method,
                params
            };
            const response = yield this.ws.sendRequest(request, { requestId: 1 });
            if ('result' in response) {
                return response.result;
            }
            else if ('error' in response) {
                throw new JRPCError(`Rollup API response error: code ${response.error.code}; message: ${response.error.message}`, response.error);
            }
            else {
                throw new Error('Unknown JRPC Error');
            }
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ws.close();
        });
    }
}
exports.WSTransport = WSTransport;
class DummyTransport extends AbstractJSONRPCTransport {
    constructor(network, ethPrivateKey, getTokens) {
        super();
        this.network = network;
        this.ethPrivateKey = ethPrivateKey;
        this.getTokens = getTokens;
    }
    getPubKeyHash() {
        return __awaiter(this, void 0, void 0, function* () {
            const ethWallet = new ethers.Wallet(this.ethPrivateKey);
            const { signer } = yield signer_1.Signer.fromETHSignature(ethWallet);
            return yield signer.pubKeyHash();
        });
    }
    request(method, params = null) {
        return __awaiter(this, void 0, void 0, function* () {
            if (method == 'contract_address') {
                return {
                    // The HEX-encoded sequence of bytes [0..20) provided as the `mainContract`.
                    mainContract: '0x000102030405060708090a0b0c0d0e0f10111213',
                    //  The `govContract` is not used in tests and it is simply an empty string.
                    govContract: ''
                };
            }
            if (method == 'tokens') {
                const tokensList = this.getTokens();
                const tokens = {};
                let id = 1;
                for (const tokenItem of tokensList.slice(0, 3)) {
                    const token = {
                        address: tokenItem.address,
                        id: id,
                        symbol: tokenItem.symbol,
                        decimals: tokenItem.decimals
                    };
                    tokens[tokenItem.symbol] = token;
                    id++;
                }
                return tokens;
            }
            if (method == 'account_info') {
                // The example `AccountState` instance:
                //  - assigns the '42' value to account_id;
                //  - assigns the committed.pubKeyHash to match the wallet's signer's PubKeyHash
                //  - adds single entry of "RIF" token to the committed balances;
                //  - adds single entry of "RDOC" token to the verified balances.
                return {
                    address: params[0],
                    id: 42,
                    depositing: {},
                    committed: {
                        balances: {
                            RIF: ethers_1.BigNumber.from(12345)
                        },
                        nonce: 0,
                        pubKeyHash: yield this.getPubKeyHash()
                    },
                    verified: {
                        balances: {
                            RDOC: ethers_1.BigNumber.from(98765)
                        },
                        nonce: 0,
                        pubKeyHash: ''
                    }
                };
            }
            return {
                method,
                params
            };
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}
exports.DummyTransport = DummyTransport;
