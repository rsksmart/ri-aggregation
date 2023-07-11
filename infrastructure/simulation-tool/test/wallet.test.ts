import { Wallet as RollupWallet, Transaction, Provider as RollupProvider } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { Wallet as EthersWallet } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    activateL2Account,
    baseDerivationPath,
    generateL1Wallets,
    createRollupWallet,
    createWalletGenerator,
    deriveL1Wallets
} from '../src/wallet';

use(sinonChai);

const MNEMONIC: string =
    'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';

describe('createWalletGenerator', () => {
    it('should return a generator', () => {
        const generator = createWalletGenerator(MNEMONIC, 0);

        expect(generator).to.be.a('Generator');
    });

    it('should return a function that returns a derived wallet', () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        const wallet = generator.next().value;

        expect(wallet.mnemonic.phrase).to.eq(MNEMONIC);
    });

    it('should return consistently derived wallets', () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        generator.next().value;
        generator.next().value;
        generator.next().value;
        const expectedWallet = generator.next().value;

        const generator2 = createWalletGenerator(MNEMONIC, 3);
        const actualWallet = generator2.next().value;

        expect(expectedWallet.address).to.eq(actualWallet.address);
    });

    it('should return wallets with provider', () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        const wallet = generator.next().value;

        expect(wallet.provider).to.not.be.undefined;
    });
});

describe('createL1Wallets', () => {
    it('should return expected number of wallets with given generator', () => {
        const testCounts = [0, 4, 10];
        const generator = createWalletGenerator(MNEMONIC, 0);

        testCounts.forEach((expectedWalletCount) => {
            let wallets = generateL1Wallets(expectedWalletCount, generator);

            expect(wallets.length).to.eq(expectedWalletCount);
        });
    });
});

describe('deriveL1Wallets', () => {
    it('should return expected number of wallets', async () => {
        const testCounts = [0, 4, 10];

        testCounts.forEach(async (expectedWalletCount) => {
            let wallets = await deriveL1Wallets(MNEMONIC, expectedWalletCount);

            expect(wallets.length).to.eq(expectedWalletCount);
        });
    });

    it('should return wallet derived from given mnemonic', async () => {
        const expectedMnemonic = MNEMONIC;
        const numberOfWallets = 5;
        const wallets = await deriveL1Wallets(expectedMnemonic, numberOfWallets);

        wallets.forEach((wallet) => {
            expect(wallet.mnemonic.phrase).to.eq(expectedMnemonic);
        });
    });

    it('should return wallet with given derivation index', async () => {
        const testIndexes = [0, 4, 10];
        const numberOfWallets = 1;
        for (const expectedIndex of testIndexes) {
            const wallets = await deriveL1Wallets(MNEMONIC, numberOfWallets, expectedIndex);

            expect(wallets.at(0).mnemonic.path).to.eq(baseDerivationPath + expectedIndex);
        }
    });

    it('should increase derivation path index for each wallet', async () => {
        const expectedIndex = 0;
        const numberOfWallets = 5;
        const wallets = await deriveL1Wallets(MNEMONIC, numberOfWallets, expectedIndex);

        wallets.forEach((wallet, index) => {
            expect(wallet.mnemonic.path).to.eq(baseDerivationPath + (expectedIndex + index));
        });
    });
});

describe('createRollupWallet', () => {
    it('should return rollup wallet', async () => {
        const actualRollupWallet = await createRollupWallet(
            EthersWallet.createRandom(),
            sinon.createStubInstance(RollupProvider)
        );

        expect(actualRollupWallet).to.be.instanceOf(RollupWallet);
        expect(actualRollupWallet).to.have.property('address');
        expect(actualRollupWallet).to.have.property('signer');
        expect(actualRollupWallet).to.have.property('provider');
        expect(actualRollupWallet).to.have.property('accountId');
        expect(actualRollupWallet).to.have.property('_ethSigner');
    });
});

describe('activateL2Account', () => {
    // MIGHT NOT BE NEEDED
    it('should activate account', async () => {
        const walletStub = sinon.createStubInstance(RollupWallet);
        walletStub.setSigningKey.callsFake(() => {
            return Promise.resolve(sinon.createStubInstance(Transaction));
        });

        await activateL2Account(walletStub);

        expect(walletStub.setSigningKey).to.have.been.calledOnce;
    });
});
