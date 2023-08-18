import { Signature } from './types';
export declare function privateKeyFromSeed(seed: Uint8Array): Promise<Uint8Array>;
export declare function signTransactionBytes(privKey: Uint8Array, bytes: Uint8Array): Promise<Signature>;
export declare function privateKeyToPubKeyHash(privateKey: Uint8Array): Promise<string>;
export declare function rescueHashOrders(orders: Uint8Array): Promise<Uint8Array>;
export declare function loadZkSyncCrypto(wasmFileUrl?: string): Promise<void>;
