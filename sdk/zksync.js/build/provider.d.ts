import { AbstractJSONRPCTransport } from './transport';
import { BigNumber, ethers } from 'ethers';
import { AccountState, Address, IncomingTxFeeType, ContractAddress, Fee, Network, PriorityOperationReceipt, TokenAddress, TokenLike, Tokens, TransactionReceipt, TxEthSignature, TxEthSignatureVariant, NFTInfo, Toggle2FARequest } from './types';
import { Governance, ZkSync, ZkSyncNFTFactory } from './typechain';
import { SyncProvider } from './provider-interface';
export declare function getDefaultProvider(network: Network, transport?: 'WS' | 'HTTP', pollIntervalMilliSecs?: number): Promise<Provider>;
export declare class Provider extends SyncProvider {
    transport: AbstractJSONRPCTransport;
    private constructor();
    /**
     * @deprecated Websocket support will be removed in future. Use HTTP transport instead.
     */
    static newWebsocketProvider(address: string, network?: Network): Promise<Provider>;
    static newHttpProvider(address?: string, pollIntervalMilliSecs?: number, network?: Network): Promise<Provider>;
    /**
     * Provides some hardcoded values the `Provider` responsible for
     * without communicating with the network
     */
    static newMockProvider(network: Network, ethPrivateKey: Uint8Array, getTokens: Function): Promise<Provider>;
    submitTx(tx: any, signature?: TxEthSignatureVariant, fastProcessing?: boolean): Promise<string>;
    submitTxsBatch(transactions: {
        tx: any;
        signature?: TxEthSignatureVariant;
    }[], ethSignatures?: TxEthSignature | TxEthSignature[]): Promise<string[]>;
    getContractAddress(): Promise<ContractAddress>;
    getTokens(): Promise<Tokens>;
    getState(address: Address): Promise<AccountState>;
    getTxReceipt(txHash: string): Promise<TransactionReceipt>;
    getPriorityOpStatus(serialId: number): Promise<PriorityOperationReceipt>;
    getConfirmationsForEthOpAmount(): Promise<number>;
    getEthTxForWithdrawal(withdrawal_hash: string): Promise<string>;
    getNFT(id: number): Promise<NFTInfo>;
    getNFTOwner(id: number): Promise<number>;
    notifyPriorityOp(serialId: number, action: 'COMMIT' | 'VERIFY'): Promise<PriorityOperationReceipt>;
    notifyTransaction(hash: string, action: 'COMMIT' | 'VERIFY'): Promise<TransactionReceipt>;
    getTransactionFee(txType: IncomingTxFeeType, address: Address, tokenLike: TokenLike): Promise<Fee>;
    getTransactionsBatchFee(txTypes: IncomingTxFeeType[], addresses: Address[], tokenLike: TokenLike): Promise<BigNumber>;
    getTokenPrice(tokenLike: TokenLike): Promise<number>;
    toggle2FA(toggle2FA: Toggle2FARequest): Promise<boolean>;
    getNFTIdByTxHash(txHash: string): Promise<number>;
    disconnect(): Promise<any>;
}
export declare class ETHProxy {
    private ethersProvider;
    contractAddress: ContractAddress;
    private governanceContract;
    private zkSyncContract;
    private zksyncNFTFactory;
    private dummySigner;
    constructor(ethersProvider: ethers.providers.Provider, contractAddress: ContractAddress);
    getGovernanceContract(): Governance;
    getZkSyncContract(): ZkSync;
    getCachedNFTDefaultFactory(): ZkSyncNFTFactory | undefined;
    getDefaultNFTFactory(): Promise<ZkSyncNFTFactory>;
    resolveTokenId(token: TokenAddress): Promise<number>;
}
