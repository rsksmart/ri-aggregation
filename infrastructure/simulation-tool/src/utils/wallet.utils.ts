import { SyncProvider as RollupProvider, Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { Wallet as EthersWallet, Signer, providers } from 'ethers';
import { CHAIN_TO_NETWORK, NETWORK_TO_DERIVATION_PATH } from '../constants/network';
import config from './config.utils';
import { Address } from '@rsksmart/rif-rollup-js-sdk/build/types';

type RollupWalletGenerator = AsyncGenerator<RollupWallet, RollupWallet>;

const baseDerivationPath: `m/44'/${number}'` = NETWORK_TO_DERIVATION_PATH[CHAIN_TO_NETWORK[config.chainId]];

export const getAccountPath = (index: number): `m/44'/${number}'/${number}'/0/0` =>
    `${baseDerivationPath}/${index}'/0/0`;

type WalletGeneratorFactoryParams = {
    mnemonic: string;
    firstIndex?: number;
    l1Provider: providers.JsonRpcProvider;
    l2Provider: RollupProvider;
};

async function* createWalletGenerator({
    mnemonic,
    firstIndex = 0,
    l1Provider,
    l2Provider
}: WalletGeneratorFactoryParams): RollupWalletGenerator {
    let index = firstIndex;
    while (true) {
        const derivationPath = getAccountPath(index++);
        yield RollupWallet.fromEthSigner(
            EthersWallet.fromMnemonic(mnemonic, derivationPath).connect(l1Provider),
            l2Provider
        );
    }
}

const getNonceFor = async (signer: Signer, nonceMap: Map<Address, number>): Promise<number> => {
    const address = await signer.getAddress();
    const nextNonce = nonceMap.has(address) ? nonceMap.get(address) + 1 : await signer.getTransactionCount('pending');
    nonceMap.set(address, nextNonce);

    return nextNonce;
};

const generateWallets = async (
    numberOfAccounts: number,
    walletGenerator: RollupWalletGenerator
): Promise<RollupWallet[]> =>
    Promise.all([...Array(numberOfAccounts)].map(async () => (await walletGenerator.next()).value));

const deriveWallets = async (
    walletCount: number,
    generatorParams: WalletGeneratorFactoryParams
): Promise<RollupWallet[]> => {
    const walletGenerator = createWalletGenerator(generatorParams);

    return generateWallets(walletCount, walletGenerator);
};

const activateL2Account = async (rollupWallet: RollupWallet): Promise<Transaction> => {
    console.log('Activating account ...');
    const signKeyTransaction = await rollupWallet.setSigningKey({
        feeToken: 'RBTC',
        ethAuthType: 'ECDSA'
    });
    console.log('Account signing receipt:', await signKeyTransaction.awaitReceipt());

    return signKeyTransaction;
};

export { activateL2Account, baseDerivationPath, createWalletGenerator, deriveWallets, generateWallets, getNonceFor };
export type { RollupWalletGenerator, WalletGeneratorFactoryParams };
