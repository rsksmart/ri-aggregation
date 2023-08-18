import { BigNumber, BigNumberish, Contract, ContractTransaction, ethers } from 'ethers';
import { EthMessageSigner } from './eth-message-signer';
import { SyncProvider } from './provider-interface';
import { BatchBuilder, BatchBuilderInternalTx } from './batch-builder';
import { AccountState, Address, ChangePubkeyTypes, NFT, Nonce, Order, PubKeyHash, SignedTransaction, TokenLike, TxEthSignature, TokenRatio, WeiRatio, Toggle2FARequest } from './types';
import { Transaction, ETHOperation } from './operations';
export declare abstract class AbstractWallet {
    cachedAddress: Address;
    accountId?: number;
    provider: SyncProvider;
    protected constructor(cachedAddress: Address, accountId?: number);
    connect(provider: SyncProvider): this;
    /**
     * Returns the current Ethereum signer connected to this wallet.
     */
    abstract ethSigner(): ethers.Signer;
    /**
     * Returns the current Ethereum **message** signer connected to this wallet.
     *
     * Ethereum message signer differs from common Ethereum signer in that message signer
     * returns Ethereum signatures along with its type (e.g. ECDSA / EIP1271).
     */
    abstract ethMessageSigner(): EthMessageSigner;
    /**
     * Returns `true` if this wallet instance has a connected L2 signer.
     */
    abstract syncSignerConnected(): boolean;
    /**
     * Returns the PubKeyHash that current *signer* uses
     * (as opposed to the one set in the account).
     */
    abstract syncSignerPubKeyHash(): Promise<PubKeyHash>;
    address(): Address;
    getCurrentPubKeyHash(): Promise<PubKeyHash>;
    getNonce(nonce?: Nonce): Promise<number>;
    getAccountId(): Promise<number | undefined>;
    getAccountState(): Promise<AccountState>;
    resolveAccountId(): Promise<number>;
    isCorrespondingSigningKeySet(): Promise<boolean>;
    isSigningKeySet(): Promise<boolean>;
    getNFT(tokenId: number, type?: 'committed' | 'verified'): Promise<NFT>;
    getBalance(token: TokenLike, type?: 'committed' | 'verified'): Promise<BigNumber>;
    getEthereumBalance(token: TokenLike): Promise<BigNumber>;
    /**
     * Creates a batch builder instance.
     *
     * @param nonce Nonce that should be used as the nonce of the first transaction in the batch.
     * @returns Batch builder object
     */
    batchBuilder(nonce?: Nonce): BatchBuilder;
    /**
     * Internal method used to process transactions created via batch builder.
     * Should not be used directly.
     */
    abstract processBatchBuilderTransactions(startNonce: Nonce, txs: BatchBuilderInternalTx[]): Promise<{
        txs: SignedTransaction[];
        signature?: TxEthSignature;
    }>;
    abstract signSyncTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    abstract syncTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    abstract signSetSigningKey(changePubKey: {
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        ethAuthType: ChangePubkeyTypes;
        batchHash?: string;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    abstract setSigningKey(changePubKey: {
        feeToken: TokenLike;
        ethAuthType: ChangePubkeyTypes;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    abstract signWithdrawFromSyncToEthereum(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    abstract withdrawFromSyncToEthereum(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        nonce?: Nonce;
        fastProcessing?: boolean;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    abstract signSyncForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    abstract syncForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    signLimitOrder(order: {
        tokenSell: TokenLike;
        tokenBuy: TokenLike;
        ratio: TokenRatio | WeiRatio;
        recipient?: Address;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Order>;
    abstract signOrder(order: {
        tokenSell: TokenLike;
        tokenBuy: TokenLike;
        ratio: TokenRatio | WeiRatio;
        amount: BigNumberish;
        recipient?: Address;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Order>;
    abstract signSyncSwap(swap: {
        orders: [Order, Order];
        feeToken: number;
        amounts: [BigNumberish, BigNumberish];
        nonce: number;
        fee: BigNumberish;
    }): Promise<SignedTransaction>;
    abstract syncSwap(swap: {
        orders: [Order, Order];
        feeToken: TokenLike;
        amounts?: [BigNumberish, BigNumberish];
        nonce?: number;
        fee?: BigNumberish;
    }): Promise<Transaction>;
    abstract signMintNFT(mintNFT: {
        recipient: string;
        contentHash: string;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
    }): Promise<SignedTransaction>;
    abstract mintNFT(mintNFT: {
        recipient: Address;
        contentHash: ethers.BytesLike;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
    }): Promise<Transaction>;
    abstract signWithdrawNFT(withdrawNFT: {
        to: string;
        token: number;
        feeToken: TokenLike;
        fee: BigNumberish;
        nonce: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<SignedTransaction>;
    abstract withdrawNFT(withdrawNFT: {
        to: string;
        token: number;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        fastProcessing?: boolean;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction>;
    abstract syncTransferNFT(transfer: {
        to: Address;
        token: NFT;
        feeToken: TokenLike;
        fee?: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }): Promise<Transaction[]>;
    abstract syncMultiTransfer(transfers: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee: BigNumberish;
        nonce?: Nonce;
        validFrom?: number;
        validUntil?: number;
    }[]): Promise<Transaction[]>;
    getToggle2FA(enable: boolean, pubKeyHash?: PubKeyHash): Promise<Toggle2FARequest>;
    toggle2FA(enable: boolean, pubKeyHash?: PubKeyHash): Promise<boolean>;
    approveERC20TokenDeposits(token: TokenLike, max_erc20_approve_amount?: BigNumber): Promise<ContractTransaction>;
    depositToSyncFromEthereum(deposit: {
        depositTo: Address;
        token: TokenLike;
        amount: BigNumberish;
        ethTxOptions?: ethers.providers.TransactionRequest;
        approveDepositAmountForERC20?: boolean;
    }): Promise<ETHOperation>;
    onchainAuthSigningKey(nonce?: Nonce, ethTxOptions?: ethers.providers.TransactionRequest): Promise<ContractTransaction>;
    emergencyWithdraw(withdraw: {
        token: TokenLike;
        accountId?: number;
        ethTxOptions?: ethers.providers.TransactionRequest;
    }): Promise<ETHOperation>;
    emergencyWithdrawNFT(withdrawNFT: {
        tokenId: number;
        accountId?: number;
        ethTxOptions?: ethers.providers.TransactionRequest;
    }): Promise<ETHOperation>;
    signRegisterFactory(factoryAddress: Address): Promise<{
        signature: TxEthSignature;
        accountId: number;
        accountAddress: Address;
    }>;
    isOnchainAuthSigningKeySet(nonce?: Nonce): Promise<boolean>;
    isERC20DepositsApproved(token: TokenLike, erc20ApproveThreshold?: BigNumber): Promise<boolean>;
    getZkSyncMainContract(): Contract;
    protected verifyNetworks(): Promise<void>;
    protected modifyEthersError(error: any): never;
    protected setRequiredAccountIdFromServer(actionName: string): Promise<void>;
}
