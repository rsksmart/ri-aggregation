import { Signer, ContractFactory, Overrides, providers } from "ethers";
type TransactionRequest = providers.TransactionRequest;
type Provider = providers.Provider;
import type { ZkSyncNFTFactory } from "./ZkSyncNFTFactory";
export declare class ZkSyncNFTFactoryFactory extends ContractFactory {
    constructor(signer?: Signer);
    deploy(name: string, symbol: string, zkSyncAddress: string, overrides?: Overrides): Promise<ZkSyncNFTFactory>;
    getDeployTransaction(name: string, symbol: string, zkSyncAddress: string, overrides?: Overrides): TransactionRequest;
    attach(address: string): ZkSyncNFTFactory;
    connect(signer: Signer): ZkSyncNFTFactoryFactory;
    static connect(address: string, signerOrProvider: Signer | Provider): ZkSyncNFTFactory;
}
export {};
