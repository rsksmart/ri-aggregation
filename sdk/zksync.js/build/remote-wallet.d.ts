import { BigNumberish, ethers } from 'ethers';
import { EthMessageSigner } from './eth-message-signer';
import { SyncProvider } from './provider-interface';
import { BatchBuilderInternalTx } from './batch-builder';
import { Address, ChangePubkeyTypes, NFT, Nonce, Order, PubKeyHash, SignedTransaction, TokenLike, TxEthSignature, TokenRatio, WeiRatio } from './types';
import { Transaction } from './operations';
import { AbstractWallet } from './abstract-wallet';
export { Transaction, ETHOperation, submitSignedTransaction, submitSignedTransactionsBatch } from './operations';
export declare class RemoteWallet extends AbstractWallet {
    private web3Provider;
    private _ethMessageSigner;
    private web3Signer;
    protected constructor(web3Provider: ethers.providers.Web3Provider, _ethMessageSigner: EthMessageSigner, cachedAddress: Address, accountId?: number);
    static fromEthSigner(web3Provider: ethers.providers.Web3Provider, provider: SyncProvider, accountId?: number): Promise<RemoteWallet>;
    ethSigner(): ethers.Signer;
    ethMessageSigner(): EthMessageSigner;
    syncSignerConnected(): boolean;
    syncSignerPubKeyHash(): Promise<PubKeyHash>;
    processBatchBuilderTransactions(startNonce: Nonce, txs: BatchBuilderInternalTx[]): Promise<{
        txs: SignedTransaction[];
        signature?: TxEthSignature;
    }>;
    signSyncTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    syncTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    signSetSigningKey(changePubKey: {
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        ethAuthType: ChangePubkeyTypes;
        batchHash?: string;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    setSigningKey(changePubKey: {
        feeToken: TokenLike;
        ethAuthType: ChangePubkeyTypes;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    signWithdrawFromSyncToEthereum(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    withdrawFromSyncToEthereum(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        nonce?: Nonce;
        fastProcessing?: boolean;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    signSyncForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    syncForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    signOrder(order: {
        tokenSell: TokenLike;
        tokenBuy: TokenLike;
        ratio: TokenRatio | WeiRatio;
        amount: BigNumberish;
        recipient?: Address;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Order>;
    signSyncSwap(swap: {
        orders: [Order, Order];
        feeToken: number;
        amounts: [BigNumberish, BigNumberish];
        nonce: number;
        fee: BigNumberish;
    }): Promise<SignedTransaction>;
    syncSwap(swap: {
        orders: [Order, Order];
        feeToken: TokenLike;
        amounts?: [BigNumberish, BigNumberish];
        nonce?: number;
        fee?: BigNumberish;
    }): Promise<Transaction>;
    signMintNFT(mintNFT: {
        recipient: string;
        contentHash: string;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
    }): Promise<SignedTransaction>;
    mintNFT(mintNFT: {
        recipient: Address;
        contentHash: ethers.BytesLike;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
    }): Promise<Transaction>;
    signWithdrawNFT(withdrawNFT: {
        to: string;
        token: number;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    withdrawNFT(withdrawNFT: {
        to: string;
        token: number;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        fastProcessing?: boolean;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    syncTransferNFT(transfer: {
        to: Address;
        token: NFT;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction[]>;
    syncMultiTransfer(_transfers: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }[]): Promise<Transaction[]>;
    /**
     *
     * Makes all fields that represent amount to be of `string` type
     * and all fields that represent tokens to be token ids i.e. of `number` type.
     * Also, it renames `ethAddress` parameter to `to` for withdrawals.
     *
     * @param txs A list of transactions
     *
     * @returns A list of prepared transactions
     */
    protected prepareTxsBeforeSending(txs: any[]): any[];
    /**
     * Performs an RPC call to the custom `zkSync_signBatch` method.
     * This method is specified here: https://github.com/argentlabs/argent-contracts-l2/discussions/4
     *
     * Basically, it's an addition to the WalletConnect server that accepts intentionally incomplete
     * transactions (e.g. with no account IDs resolved), and returns transactions with both L1 and L2
     * signatures.
     *
     * @param txs A list of transactions to be signed.
     *
     * @returns A list of singed transactions.
     */
    protected callExtSignZkSyncBatch(txs: any[]): Promise<SignedTransaction[]>;
    /**
     * Performs an RPC call to the custom `zkSync_signBatch` method.
     *
     * @param txs An order data to be signed.
     *
     * @returns The completed and signed offer.
     */
    protected callExtSignOrder(order: any): Promise<Order>;
    /**
     * Performs an RPC call to the custom `zkSync_signerPubKeyHash` method.
     *
     * This method should return a public key hash associated with the wallet
     */
    protected callExtSignerPubKeyHash(): Promise<PubKeyHash>;
}
