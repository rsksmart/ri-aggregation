import WebSocketAsPromised = require('websocket-as-promised');
import { PubKeyHash } from './types';
export declare abstract class AbstractJSONRPCTransport {
    abstract request(method: string, params: any): Promise<any>;
    subscriptionsSupported(): boolean;
    subscribe(subMethod: string, subParams: any, unsubMethod: string, cb: (data: any) => void): Promise<Subscription>;
    abstract disconnect(): any;
}
export declare class JRPCError extends Error {
    jrpcError: JRPCErrorObject;
    constructor(message: string, jrpcError: JRPCErrorObject);
}
export interface JRPCErrorObject {
    code: number;
    message: string;
    data: any;
}
declare class Subscription {
    unsubscribe: () => Promise<void>;
    constructor(unsubscribe: () => Promise<void>);
}
export declare class HTTPTransport extends AbstractJSONRPCTransport {
    address: string;
    constructor(address: string);
    request(method: string, params?: any, config?: any): Promise<any>;
    disconnect(): Promise<void>;
}
/**
 * @deprecated Websocket support will be removed in future. Use HTTP transport instead.
 */
export declare class WSTransport extends AbstractJSONRPCTransport {
    address: string;
    ws: WebSocketAsPromised;
    private subscriptionCallback;
    private constructor();
    static connect(address?: string): Promise<WSTransport>;
    subscriptionsSupported(): boolean;
    subscribe(subMethod: string, subParams: any, unsubMethod: string, cb: (data: any) => void): Promise<Subscription>;
    request(method: string, params?: any): Promise<any>;
    disconnect(): Promise<void>;
}
export declare class DummyTransport extends AbstractJSONRPCTransport {
    network: string;
    ethPrivateKey: Uint8Array;
    getTokens: Function;
    constructor(network: string, ethPrivateKey: Uint8Array, getTokens: Function);
    getPubKeyHash(): Promise<PubKeyHash>;
    request(method: string, params?: any): Promise<any>;
    disconnect(): Promise<void>;
}
export {};
