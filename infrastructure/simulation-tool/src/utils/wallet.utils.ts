import { SyncProvider as RollupProvider, Transaction, Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { Wallet as EthersWallet, constants, providers } from 'ethers';
import config from './config.utils';
import { NETWORK_TO_DERIVATION_PATH, CHAIN_TO_NETWORK } from '../constants/network';

type L1WalletGenerator = Generator<EthersWallet>;

const baseDerivationPath: string = NETWORK_TO_DERIVATION_PATH[CHAIN_TO_NETWORK[config.chainId]];

function* createWalletGenerator(mnemonic: string, firstIndex: number = 0): Generator<EthersWallet> {
    const l1Provider = new providers.JsonRpcProvider(config.nodeUrl);
    let index = firstIndex;
    while (true) {
        const derivationPath = baseDerivationPath + index++;

        const yieldLog = yield EthersWallet.fromMnemonic(mnemonic, derivationPath).connect(l1Provider);
        yieldLog && console.log(`Generated ${derivationPath} log:`, yieldLog);
    }
}

const generateL1Wallets = (numberOfAccounts: number, l1WalletGenerator: Generator<EthersWallet>): EthersWallet[] =>
    [...Array(numberOfAccounts)].map(() => l1WalletGenerator.next().value);

const deriveL1Wallets = async (
    mnemonic: string,
    walletCount: number,
    firstDerivationIndex: number = 0
): Promise<EthersWallet[]> => {
    const walletGenerator = createWalletGenerator(mnemonic, firstDerivationIndex);

    return generateL1Wallets(walletCount, walletGenerator);
};

const activateL2Account = async (rollupWallet: RollupWallet): Promise<Transaction> => {
    // might not be needed
    console.log('Activating account ...');
    const signKeyTransaction = await rollupWallet.setSigningKey({
        feeToken: constants.AddressZero,
        ethAuthType: 'ECDSA'
    });
    console.log('Account signing receipt:', await signKeyTransaction.awaitReceipt());

    return signKeyTransaction;
};

const createRollupWallet = (l1Wallet: EthersWallet, syncProvider: RollupProvider): Promise<RollupWallet> =>
    RollupWallet.fromEthSigner(l1Wallet, syncProvider);

const chooseRandomWallet = (wallets: EthersWallet[]) => {
    const randIndex = Math.floor(Math.random() * wallets.length);
    return wallets.at(randIndex);
};

export type { L1WalletGenerator };
export {
    baseDerivationPath,
    createRollupWallet,
    deriveL1Wallets,
    generateL1Wallets,
    activateL2Account,
    createWalletGenerator,
    chooseRandomWallet
};
