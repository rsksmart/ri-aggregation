import { Signer, ContractFactory, Overrides, providers } from "ethers";
type TransactionRequest = providers.TransactionRequest;
type Provider = providers.Provider;
import type { ZkSync } from "./ZkSync";
export declare class ZkSyncFactory extends ContractFactory {
    constructor(signer?: Signer);
    deploy(overrides?: Overrides): Promise<ZkSync>;
    getDeployTransaction(overrides?: Overrides): TransactionRequest;
    attach(address: string): ZkSync;
    connect(signer: Signer): ZkSyncFactory;
    static connect(address: string, signerOrProvider: Signer | Provider): ZkSync;
}
export {};
