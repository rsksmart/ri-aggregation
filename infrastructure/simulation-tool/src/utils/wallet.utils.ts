import {
    SyncProvider as RollupProvider,
    Transaction,
    Wallet as RollupWallet,
    RestProvider
} from '@rsksmart/rif-rollup-js-sdk';
import { Wallet as EthersWallet, providers } from 'ethers';
import config from './config.utils';
import { NETWORK_TO_DERIVATION_PATH, CHAIN_TO_NETWORK, HardenedBit } from '../constants/network';

type RollupWalletGenerator = AsyncGenerator<RollupWallet, RollupWallet>;

const baseDerivationPath: `m/44'/${number}'` = NETWORK_TO_DERIVATION_PATH[CHAIN_TO_NETWORK[config.chainId]];

export function getAccountPath(index: number): `m/44'/${number}'/${number}'/0/0` {
    if (typeof index !== 'number' || index < 0 || index >= HardenedBit || index % 1) {
        throw Error(`invalid account index: ${index}`);
    }
    return `${baseDerivationPath}/${index}'/0/0`;
}

async function* createWalletGenerator(mnemonic: string, firstIndex: number = 0): RollupWalletGenerator {
    const { nodeUrl, rollupUrl } = config;
    const l1Provider = new providers.JsonRpcProvider(nodeUrl);
    const rollupProvider: RollupProvider = await RestProvider.newProvider(`${rollupUrl}/api/v0.2`);
    let index = firstIndex;
    while (true) {
        const derivationPath = getAccountPath(index++);
        console.log('🦆 ~ file: wallet.utils.ts:29 ~ function*createWalletGenerator ~ derivationPath:', derivationPath);

        yield RollupWallet.fromEthSigner(
            EthersWallet.fromMnemonic(mnemonic, derivationPath).connect(l1Provider),
            rollupProvider
        );
    }
}

const generateWallets = async (
    numberOfAccounts: number,
    walletGenerator: RollupWalletGenerator
): Promise<RollupWallet[]> =>
    Promise.all([...Array(numberOfAccounts)].map(async () => (await walletGenerator.next()).value));

const deriveWallets = async (
    mnemonic: string,
    walletCount: number,
    firstDerivationIndex: number = 0
): Promise<RollupWallet[]> => {
    const walletGenerator = createWalletGenerator(mnemonic, firstDerivationIndex);

    return generateWallets(walletCount, walletGenerator);
};

const activateL2Account = async (rollupWallet: RollupWallet): Promise<Transaction> => {
    // might not be needed
    console.log('Activating account ...');
    const signKeyTransaction = await rollupWallet.setSigningKey({
        feeToken: 'RBTC',
        ethAuthType: 'ECDSA'
    });
    console.log('Account signing receipt:', await signKeyTransaction.awaitReceipt());

    return signKeyTransaction;
};

export type { RollupWalletGenerator };
export { baseDerivationPath, deriveWallets, generateWallets, activateL2Account, createWalletGenerator };
