import { BigNumberish, ethers } from 'ethers';
import { EthMessageSigner } from './eth-message-signer';
import { SyncProvider } from './provider-interface';
import { Signer } from './signer';
import { BatchBuilderInternalTx } from './batch-builder';
import { Address, ChangePubKey, ChangePubKeyCREATE2, ChangePubKeyECDSA, ChangePubKeyOnchain, ChangePubkeyTypes, Create2Data, EthSignerType, ForcedExit, MintNFT, NFT, Nonce, Order, PubKeyHash, SignedTransaction, Swap, TokenLike, Transfer, TxEthSignature, Withdraw, WithdrawNFT, TokenRatio, WeiRatio } from './types';
import { Transaction } from './operations';
import { AbstractWallet } from './abstract-wallet';
export { Transaction, ETHOperation, submitSignedTransaction, submitSignedTransactionsBatch } from './operations';
export declare class Wallet extends AbstractWallet {
    _ethSigner: ethers.Signer;
    private _ethMessageSigner;
    signer?: Signer;
    ethSignerType?: EthSignerType;
    protected constructor(_ethSigner: ethers.Signer, _ethMessageSigner: EthMessageSigner, cachedAddress: Address, signer?: Signer, accountId?: number, ethSignerType?: EthSignerType);
    static fromEthSigner(ethWallet: ethers.Signer, provider: SyncProvider, signer?: Signer, accountId?: number, ethSignerType?: EthSignerType): Promise<Wallet>;
    static fromCreate2Data(syncSigner: Signer, provider: SyncProvider, create2Data: Create2Data, accountId?: number): Promise<Wallet>;
    static fromEthSignerNoKeys(ethWallet: ethers.Signer, provider: SyncProvider, accountId?: number, ethSignerType?: EthSignerType): Promise<Wallet>;
    static fromSyncSigner(ethWallet: ethers.Signer, syncSigner: Signer, provider: SyncProvider, accountId?: number): Promise<Wallet>;
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
    signOrder(orderData: {
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
    syncMultiTransfer(transfers: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }[]): Promise<Transaction[]>;
    protected getTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Transfer>;
    protected getChangePubKey(changePubKey: {
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        ethAuthData?: ChangePubKeyOnchain | ChangePubKeyECDSA | ChangePubKeyCREATE2;
        ethSignature?: string;
        validFrom: number;
        validUntil: number;
    }): Promise<ChangePubKey>;
    protected getWithdrawFromSyncToEthereum(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Withdraw>;
    protected getForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<ForcedExit>;
    protected getSwap(swap: {
        orders: [Order, Order];
        feeToken: number;
        amounts: [BigNumberish, BigNumberish];
        nonce: number;
        fee: BigNumberish;
    }): Promise<Swap>;
    protected getMintNFT(mintNFT: {
        recipient: string;
        contentHash: string;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
    }): Promise<MintNFT>;
    protected getWithdrawNFT(withdrawNFT: {
        to: string;
        token: TokenLike;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<WithdrawNFT>;
    getWithdrawNFTEthMessagePart(withdrawNFT: {
        to: string;
        token: number;
        feeToken: TokenLike;
        fee: BigNumberish;
    }): string;
    getTransferEthMessagePart(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
    }): Promise<string>;
    getWithdrawEthMessagePart(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
    }): string;
    getChangePubKeyEthMessagePart(changePubKey: {
        pubKeyHash: string;
        feeToken: TokenLike;
        fee: BigNumberish;
    }): string;
    getMintNFTEthMessagePart(mintNFT: {
        recipient: string;
        contentHash: string;
        feeToken: TokenLike;
        fee: BigNumberish;
    }): string;
    getSwapEthSignMessagePart(swap: {
        fee: BigNumberish;
        feeToken: TokenLike;
    }): string;
    getForcedExitEthMessagePart(forcedExit: {
        target: Address;
        token: TokenLike;
        fee: BigNumberish;
    }): string;
    getPartialOrder(order: {
        tokenSell: TokenLike;
        tokenBuy: TokenLike;
        ratio: TokenRatio | WeiRatio;
        amount: BigNumberish;
        recipient?: Address;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Order>;
}
