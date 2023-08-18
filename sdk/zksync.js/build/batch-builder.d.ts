import { BigNumberish } from 'ethers';
import { Address, TokenLike, Nonce, ChangePubKeyFee, SignedTransaction, TxEthSignature, ChangePubkeyTypes, TotalFee, Order } from './types';
import { AbstractWallet } from './abstract-wallet';
/**
 * Used by `BatchBuilder` to store transactions until the `build()` call.
 */
export interface BatchBuilderInternalTx {
    type: 'Withdraw' | 'Transfer' | 'ChangePubKey' | 'ForcedExit' | 'MintNFT' | 'WithdrawNFT' | 'Swap';
    tx: any;
    feeType: 'Withdraw' | 'Transfer' | 'FastWithdraw' | 'ForcedExit' | ChangePubKeyFee | 'Swap' | 'MintNFT' | 'WithdrawNFT' | 'ForcedExit';
    address: Address;
    token: TokenLike;
    alreadySigned?: boolean;
}
/**
 * Provides interface for constructing batches of transactions.
 */
export declare class BatchBuilder {
    private wallet;
    private nonce;
    private txs;
    private constructor();
    static fromWallet(wallet: AbstractWallet, nonce?: Nonce): BatchBuilder;
    /**
     * Construct the batch from the given transactions.
     * Returs it with the corresponding Ethereum signature and total fee.
     * @param feeToken If provided, the fee for the whole batch will be obtained from the server in this token.
     * Possibly creates phantom transfer.
     */
    build(feeToken?: TokenLike): Promise<{
        txs: SignedTransaction[];
        signature?: TxEthSignature;
        totalFee: TotalFee;
    }>;
    private setFeeToken;
    addWithdraw(withdraw: {
        ethAddress: string;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        validFrom?: number;
        validUntil?: number;
    }): BatchBuilder;
    addMintNFT(mintNFT: {
        recipient: string;
        contentHash: string;
        feeToken: TokenLike;
        fee?: BigNumberish;
    }): BatchBuilder;
    addWithdrawNFT(withdrawNFT: {
        to: string;
        token: TokenLike;
        feeToken: TokenLike;
        fee?: BigNumberish;
        validFrom?: number;
        validUntil?: number;
    }): BatchBuilder;
    addSwap(swap: {
        orders: [Order, Order];
        amounts: [BigNumberish, BigNumberish];
        feeToken: TokenLike;
        fee?: BigNumberish;
    }): BatchBuilder;
    addTransfer(transfer: {
        to: Address;
        token: TokenLike;
        amount: BigNumberish;
        fee?: BigNumberish;
        validFrom?: number;
        validUntil?: number;
    }): BatchBuilder;
    addChangePubKey(changePubKey: {
        feeToken: TokenLike;
        ethAuthType: ChangePubkeyTypes;
        fee?: BigNumberish;
        validFrom?: number;
        validUntil?: number;
    } | SignedTransaction): BatchBuilder;
    addForcedExit(forcedExit: {
        target: Address;
        token: TokenLike;
        fee?: BigNumberish;
        validFrom?: number;
        validUntil?: number;
    }): BatchBuilder;
    /**
     * Sets transactions nonces, assembles the batch and constructs the message to be signed by user.
     */
    private processTransactions;
}
