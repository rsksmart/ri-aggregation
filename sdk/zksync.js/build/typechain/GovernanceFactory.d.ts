import { Signer, providers, ContractFactory, Overrides } from "ethers";
type TransactionRequest = providers.TransactionRequest;
type Provider = providers.Provider;
import type { Governance } from "./Governance";
export declare class GovernanceFactory extends ContractFactory {
    constructor(signer?: Signer);
    deploy(overrides?: Overrides): Promise<Governance>;
    getDeployTransaction(overrides?: Overrides): TransactionRequest;
    attach(address: string): Governance;
    connect(signer: Signer): GovernanceFactory;
    static connect(address: string, signerOrProvider: Signer | Provider): Governance;
}
export {};
