import { BigNumber } from 'ethers';
import { SyncProvider } from './provider-interface';
import * as types from './types';
import { Network } from './types';
export declare function getDefaultRestProvider(network: types.Network, pollIntervalMilliSecs?: number): Promise<RestProvider>;
export interface Request {
    network: types.Network;
    apiVersion: 'v02';
    resource: string;
    args: any;
    timestamp: string;
}
export interface Error {
    errorType: string;
    code: number;
    message: string;
}
export interface Response<T> {
    request: Request;
    status: 'success' | 'error';
    error?: Error;
    result?: T;
}
export declare class RESTError extends Error {
    restError: Error;
    constructor(message: string, restError: Error);
}
export declare class RestProvider extends SyncProvider {
    address: string;
    static readonly MAX_LIMIT = 100;
    private constructor();
    static newProvider(address?: string, pollIntervalMilliSecs?: number, network?: Network): Promise<RestProvider>;
    parseResponse<T>(response: Response<T>): T;
    get<T>(url: string): Promise<Response<T>>;
    post<T>(url: string, body: any): Promise<Response<T>>;
    accountInfoDetailed(idOrAddress: number | types.Address, infoType: 'committed' | 'finalized'): Promise<Response<types.ApiAccountInfo>>;
    accountInfo(idOrAddress: number | types.Address, infoType: 'committed' | 'finalized'): Promise<types.ApiAccountInfo>;
    toggle2FADetailed(data: types.Toggle2FARequest): Promise<Response<types.Toggle2FAResponse>>;
    toggle2FA(data: types.Toggle2FARequest): Promise<boolean>;
    accountFullInfoDetailed(idOrAddress: number | types.Address): Promise<Response<types.ApiAccountFullInfo>>;
    accountFullInfo(idOrAddress: number | types.Address): Promise<types.ApiAccountFullInfo>;
    accountTxsDetailed(idOrAddress: number | types.Address, paginationQuery: types.PaginationQuery<string>, token?: types.TokenLike, secondIdOrAddress?: number | types.Address): Promise<Response<types.Paginated<types.ApiTransaction, string>>>;
    accountTxs(idOrAddress: number | types.Address, paginationQuery: types.PaginationQuery<string>, token?: types.TokenLike, secondIdOrAddress?: number | types.Address): Promise<types.Paginated<types.ApiTransaction, string>>;
    accountPendingTxsDetailed(idOrAddress: number | types.Address, paginationQuery: types.PaginationQuery<number>): Promise<Response<types.Paginated<types.ApiTransaction, number>>>;
    accountPendingTxs(idOrAddress: number | types.Address, paginationQuery: types.PaginationQuery<number>): Promise<types.Paginated<types.ApiTransaction, number>>;
    blockPaginationDetailed(paginationQuery: types.PaginationQuery<number>): Promise<Response<types.Paginated<types.ApiBlockInfo, number>>>;
    blockPagination(paginationQuery: types.PaginationQuery<number>): Promise<types.Paginated<types.ApiBlockInfo, number>>;
    blockByPositionDetailed(blockPosition: types.BlockPosition): Promise<Response<types.ApiBlockInfo>>;
    blockByPosition(blockPosition: types.BlockPosition): Promise<types.ApiBlockInfo>;
    blockTransactionsDetailed(blockPosition: types.BlockPosition, paginationQuery: types.PaginationQuery<string>): Promise<Response<types.Paginated<types.ApiTransaction, string>>>;
    blockTransactions(blockPosition: types.BlockPosition, paginationQuery: types.PaginationQuery<string>): Promise<types.Paginated<types.ApiTransaction, string>>;
    configDetailed(): Promise<Response<types.ApiConfig>>;
    config(): Promise<types.ApiConfig>;
    getTransactionFeeDetailed(txType: types.IncomingTxFeeType, address: types.Address, tokenLike: types.TokenLike): Promise<Response<types.FeeRest>>;
    getTransactionFee(txType: types.IncomingTxFeeType, address: types.Address, tokenLike: types.TokenLike): Promise<types.FeeRest>;
    getBatchFullFeeDetailed(transactions: {
        txType: types.IncomingTxFeeType;
        address: types.Address;
    }[], tokenLike: types.TokenLike): Promise<Response<types.FeeRest>>;
    getBatchFullFee(transactions: {
        txType: types.IncomingTxFeeType;
        address: types.Address;
    }[], tokenLike: types.TokenLike): Promise<types.FeeRest>;
    networkStatusDetailed(): Promise<Response<types.NetworkStatus>>;
    networkStatus(): Promise<types.NetworkStatus>;
    tokenPaginationDetailed(paginationQuery: types.PaginationQuery<number>): Promise<Response<types.Paginated<types.TokenInfo, number>>>;
    tokenPagination(paginationQuery: types.PaginationQuery<number>): Promise<types.Paginated<types.TokenInfo, number>>;
    tokenInfoDetailed(tokenLike: types.TokenLike): Promise<Response<types.TokenInfo>>;
    tokenInfo(tokenLike: types.TokenLike): Promise<types.TokenInfo>;
    tokenPriceInfoDetailed(tokenLike: types.TokenLike, tokenIdOrUsd: number | 'usd'): Promise<Response<types.TokenPriceInfo>>;
    tokenPriceInfo(tokenLike: types.TokenLike, tokenIdOrUsd: number | 'usd'): Promise<types.TokenPriceInfo>;
    submitTxNewDetailed(tx: types.L2Tx, signature?: types.TxEthSignatureVariant): Promise<Response<string>>;
    submitTxNew(tx: types.L2Tx, signature?: types.TxEthSignatureVariant): Promise<string>;
    /**
     * @deprecated Use submitTxNew method instead
     */
    submitTx(tx: any, signature?: types.TxEthSignatureVariant, fastProcessing?: boolean): Promise<string>;
    txStatusDetailed(txHash: string): Promise<Response<types.ApiTxReceipt>>;
    txStatus(txHash: string): Promise<types.ApiTxReceipt>;
    txDataDetailed(txHash: string): Promise<Response<types.ApiSignedTx>>;
    txData(txHash: string): Promise<types.ApiSignedTx>;
    submitTxsBatchNewDetailed(txs: {
        tx: any;
        signature?: types.TxEthSignatureVariant;
    }[], signature?: types.TxEthSignature | types.TxEthSignature[]): Promise<Response<types.SubmitBatchResponse>>;
    submitTxsBatchNew(txs: {
        tx: any;
        signature?: types.TxEthSignatureVariant;
    }[], signature?: types.TxEthSignature | types.TxEthSignature[]): Promise<types.SubmitBatchResponse>;
    /**
     * @deprecated Use submitTxsBatchNew method instead.
     */
    submitTxsBatch(transactions: {
        tx: any;
        signature?: types.TxEthSignatureVariant;
    }[], ethSignatures?: types.TxEthSignature | types.TxEthSignature[]): Promise<string[]>;
    getBatchDetailed(batchHash: string): Promise<Response<types.ApiBatchData>>;
    getBatch(batchHash: string): Promise<types.ApiBatchData>;
    getNFTDetailed(id: number): Promise<Response<types.NFTInfo>>;
    getNFT(id: number): Promise<types.NFTInfo>;
    getNFTOwnerDetailed(id: number): Promise<Response<number>>;
    getNFTOwner(id: number): Promise<number>;
    getNFTIdByTxHashDetailed(txHash: string): Promise<Response<number>>;
    getNFTIdByTxHash(txHash: string): Promise<number>;
    notifyAnyTransaction(hash: string, action: 'COMMIT' | 'VERIFY'): Promise<types.ApiTxReceipt>;
    notifyTransaction(hash: string, action: 'COMMIT' | 'VERIFY'): Promise<types.TransactionReceipt>;
    notifyPriorityOp(hash: string, action: 'COMMIT' | 'VERIFY'): Promise<types.PriorityOperationReceipt>;
    getContractAddress(): Promise<types.ContractAddress>;
    getTokens(limit?: number): Promise<types.ExtendedTokens>;
    getState(address: types.Address): Promise<types.AccountState>;
    getConfirmationsForEthOpAmount(): Promise<number>;
    getTransactionsBatchFee(txTypes: types.IncomingTxFeeType[], addresses: types.Address[], tokenLike: types.TokenLike): Promise<BigNumber>;
    getTokenPrice(tokenLike: types.TokenLike): Promise<number>;
    getTxReceipt(txHash: string): Promise<types.TransactionReceipt>;
    getPriorityOpStatus(hash: string): Promise<types.PriorityOperationReceipt>;
    getEthTxForWithdrawal(withdrawalHash: string): Promise<string>;
}
