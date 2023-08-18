import { BigNumberish, ContractTransaction } from 'ethers';
import { Address, TokenLike, Network } from './types';
declare module './wallet' {
    interface Wallet {
        withdrawPendingBalance(from: Address, token: TokenLike, amount?: BigNumberish): Promise<ContractTransaction>;
        withdrawPendingBalances(addresses: Address[], tokens: TokenLike[], multicallParams: MulticallParams, amounts?: BigNumberish[]): Promise<ContractTransaction>;
    }
}
interface MulticallParams {
    address?: Address;
    network?: Network;
    gasLimit?: BigNumberish;
}
export {};
