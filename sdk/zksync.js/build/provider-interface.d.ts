import { AccountState, Address, ContractAddress, Fee, IncomingTxFeeType, PriorityOperationReceipt, TokenLike, Tokens, TransactionReceipt, TxEthSignature, TxEthSignatureVariant, NFTInfo, Toggle2FARequest, Network } from './types';
import { BigNumber } from 'ethers';
import { TokenSet } from './utils';
export declare abstract class SyncProvider {
    contractAddress: ContractAddress;
    tokenSet: TokenSet;
    providerType: 'RPC' | 'Rest';
    pollIntervalMilliSecs: number;
    network?: Network;
    abstract submitTx(tx: any, signature?: TxEthSignatureVariant, fastProcessing?: boolean): Promise<string>;
    abstract submitTxsBatch(transactions: {
        tx: any;
        signature?: TxEthSignatureVariant;
    }[], ethSignatures?: TxEthSignature | TxEthSignature[]): Promise<string[]>;
    abstract getContractAddress(): Promise<ContractAddress>;
    abstract getTokens(): Promise<Tokens>;
    abstract getState(address: Address): Promise<AccountState>;
    abstract getTxReceipt(txHash: string): Promise<TransactionReceipt>;
    abstract getPriorityOpStatus(hashOrSerialId: string | number): Promise<PriorityOperationReceipt>;
    abstract getConfirmationsForEthOpAmount(): Promise<number>;
    abstract notifyPriorityOp(hashOrSerialId: string | number, action: 'COMMIT' | 'VERIFY'): Promise<PriorityOperationReceipt>;
    abstract notifyTransaction(hash: string, action: 'COMMIT' | 'VERIFY'): Promise<TransactionReceipt>;
    abstract getTransactionFee(txType: IncomingTxFeeType, address: Address, tokenLike: TokenLike): Promise<Fee>;
    abstract getTransactionsBatchFee(txTypes: IncomingTxFeeType[], addresses: Address[], tokenLike: TokenLike): Promise<BigNumber>;
    abstract getTokenPrice(tokenLike: TokenLike): Promise<number>;
    abstract getEthTxForWithdrawal(withdrawalHash: string): Promise<string>;
    abstract getNFT(id: number): Promise<NFTInfo>;
    abstract getNFTOwner(id: number): Promise<number>;
    abstract toggle2FA(data: Toggle2FARequest): Promise<boolean>;
    abstract getNFTIdByTxHash(txHash: string): Promise<number>;
    updateTokenSet(): Promise<void>;
    getTokenSymbol(token: TokenLike): Promise<string>;
    disconnect(): Promise<void>;
}
