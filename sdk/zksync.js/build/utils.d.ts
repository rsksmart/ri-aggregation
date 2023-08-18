import { utils, ethers, BigNumber, BigNumberish } from 'ethers';
import { SyncProvider } from './provider-interface';
import { PubKeyHash, TokenAddress, TokenLike, Tokens, TokenSymbol, EthSignerType, Address, Transfer, ForcedExit, ChangePubKey, Withdraw, CloseAccount, MintNFT, Order, Swap, TokenRatio, WeiRatio, WithdrawNFT } from './types';
export declare const MAX_TIMESTAMP = 4294967295;
export declare const MIN_NFT_TOKEN_ID = 65536;
export declare const CURRENT_TX_VERSION = 1;
export declare const IERC20_INTERFACE: utils.Interface;
export declare const SYNC_MAIN_CONTRACT_INTERFACE: utils.Interface;
export declare const SYNC_GOV_CONTRACT_INTERFACE: utils.Interface;
export declare const SYNC_NFT_FACTORY_INTERFACE: utils.Interface;
export declare const IEIP1271_INTERFACE: utils.Interface;
export declare const MULTICALL_INTERFACE: utils.Interface;
export declare const ERC20_DEPOSIT_GAS_LIMIT: any;
export declare const MAX_ERC20_APPROVE_AMOUNT: ethers.BigNumber;
export declare const ERC20_APPROVE_TRESHOLD: ethers.BigNumber;
export declare const RBTC_RECOMMENDED_DEPOSIT_GAS_LIMIT: ethers.BigNumber;
export declare const ERC20_RECOMMENDED_DEPOSIT_GAS_LIMIT: ethers.BigNumber;
export declare function tokenRatio(ratio: {
    [token: string]: string | number;
    [token: number]: string | number;
}): TokenRatio;
export declare function weiRatio(ratio: {
    [token: string]: BigNumberish;
    [token: number]: BigNumberish;
}): WeiRatio;
export declare function floatToInteger(floatBytes: Uint8Array, expBits: number, mantissaBits: number, expBaseNumber: number): BigNumber;
export declare function bitsIntoBytesInBEOrder(bits: number[]): Uint8Array;
export declare function integerToFloat(integer: BigNumber, expBits: number, mantissaBits: number, expBase: number): Uint8Array;
export declare function integerToFloatUp(integer: BigNumber, expBits: number, mantissaBits: number, expBase: number): Uint8Array;
export declare function reverseBits(buffer: Uint8Array): Uint8Array;
export declare function packAmountChecked(amount: BigNumber): Uint8Array;
export declare function packFeeChecked(amount: BigNumber): Uint8Array;
/**
 * packs and unpacks the amount, returning the closest packed value.
 * e.g 1000000003 => 1000000000
 * @param amount
 */
export declare function closestPackableTransactionAmount(amount: BigNumberish): BigNumber;
export declare function closestGreaterOrEqPackableTransactionAmount(amount: BigNumberish): BigNumber;
export declare function isTransactionAmountPackable(amount: BigNumberish): boolean;
/**
 * packs and unpacks the amount, returning the closest packed value.
 * e.g 1000000003 => 1000000000
 * @param fee
 */
export declare function closestPackableTransactionFee(fee: BigNumberish): BigNumber;
export declare function closestGreaterOrEqPackableTransactionFee(fee: BigNumberish): BigNumber;
export declare function isTransactionFeePackable(amount: BigNumberish): boolean;
export declare function isNFT(token: TokenLike): boolean;
export declare function buffer2bitsBE(buff: any): any[];
export declare function sleep(ms: number): Promise<unknown>;
export declare function isTokenRBTC(token: TokenLike): boolean;
type TokenOrId = TokenLike | number;
export declare class TokenSet {
    private tokensBySymbol;
    constructor(tokensBySymbol: Tokens);
    private resolveTokenObject;
    isTokenTransferAmountPackable(tokenLike: TokenOrId, amount: string): boolean;
    isTokenTransactionFeePackable(tokenLike: TokenOrId, amount: string): boolean;
    formatToken(tokenLike: TokenOrId, amount: BigNumberish): string;
    parseToken(tokenLike: TokenOrId, amount: string): BigNumber;
    resolveTokenDecimals(tokenLike: TokenOrId): number;
    resolveTokenId(tokenLike: TokenOrId): number;
    resolveTokenAddress(tokenLike: TokenOrId): TokenAddress;
    resolveTokenSymbol(tokenLike: TokenOrId): TokenSymbol;
}
export declare function getChangePubkeyMessage(pubKeyHash: PubKeyHash, nonce: number, accountId: number, batchHash?: string): Uint8Array;
export declare function getChangePubkeyLegacyMessage(pubKeyHash: PubKeyHash, nonce: number, accountId: number): Uint8Array;
export declare function getToggle2FAMessage(require2FA: boolean, timestamp: number, pubKeyHash?: PubKeyHash): Uint8Array;
export declare function getSignedBytesFromMessage(message: utils.BytesLike | string, addPrefix: boolean): Uint8Array;
export declare function signMessagePersonalAPI(signer: ethers.Signer, message: Uint8Array): Promise<string>;
export declare function verifyERC1271Signature(address: string, message: Uint8Array, signature: string, signerOrProvider: ethers.Signer | ethers.providers.Provider, messagePrefixed?: boolean): Promise<boolean>;
export declare function getEthSignatureType(_provider: ethers.providers.Provider, message: utils.BytesLike | string, signature: string, address: string): Promise<EthSignerType>;
export declare function serializeContentHash(contentHash: string): Uint8Array;
export declare function serializeAddress(address: Address | PubKeyHash): Uint8Array;
export declare function serializeAccountId(accountId: number): Uint8Array;
export declare function serializeTokenId(tokenId: number): Uint8Array;
export declare function serializeAmountPacked(amount: BigNumberish): Uint8Array;
export declare function serializeAmountFull(amount: BigNumberish): Uint8Array;
export declare function serializeFeePacked(fee: BigNumberish): Uint8Array;
export declare function serializeNonce(nonce: number): Uint8Array;
export declare function serializeTimestamp(time: number): Uint8Array;
export declare function serializeOrder(order: Order): Uint8Array;
export declare function serializeSwap(swap: Swap): Promise<Uint8Array>;
export declare function serializeWithdraw(withdraw: Withdraw): Uint8Array;
export declare function serializeMintNFT(mintNFT: MintNFT): Uint8Array;
export declare function serializeWithdrawNFT(withdrawNFT: WithdrawNFT): Uint8Array;
export declare function serializeTransfer(transfer: Transfer): Uint8Array;
export declare function serializeChangePubKey(changePubKey: ChangePubKey): Uint8Array;
export declare function serializeForcedExit(forcedExit: ForcedExit): Uint8Array;
/**
 * Encodes the transaction data as the byte sequence according to the Rollup protocol.
 * @param tx A transaction to serialize.
 */
export declare function serializeTx(tx: Transfer | Withdraw | ChangePubKey | CloseAccount | ForcedExit | MintNFT | WithdrawNFT | Swap): Promise<Uint8Array>;
export declare function numberToBytesBE(number: number, bytes: number): Uint8Array;
export declare function parseHexWithPrefix(str: string): Uint8Array;
export declare function getCREATE2AddressAndSalt(syncPubkeyHash: string, create2Data: {
    creatorAddress: string;
    saltArg: string;
    codeHash: string;
}): {
    salt: string;
    address: string;
};
export declare function getEthereumBalance(ethProvider: ethers.providers.Provider, syncProvider: SyncProvider, address: Address, token: TokenLike): Promise<BigNumber>;
export declare function getPendingBalance(ethProvider: ethers.providers.Provider, syncProvider: SyncProvider, address: Address, token: TokenLike): Promise<BigNumberish>;
export declare function getTxHash(tx: Transfer | Withdraw | ChangePubKey | ForcedExit | CloseAccount | Swap | MintNFT | WithdrawNFT): Promise<string>;
export {};
