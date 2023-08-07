import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { Wallet as EthersWallet } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    activateL2Account,
    createWalletGenerator,
    deriveWallets,
    generateWallets,
    getAccountPath
} from '../../src/utils/wallet.utils';

use(sinonChai);

const MNEMONIC: string =
    'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';

describe('createWalletGenerator', () => {
    it('should return a generator', () => {
        const generator = createWalletGenerator(MNEMONIC, 0);

        expect(generator).to.be.a('Generator');
    });

    it('should return a function that returns a derived wallet', async () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        const wallet = (await generator.next()).value;
        const expectedAddress = EthersWallet.fromMnemonic(MNEMONIC, getAccountPath(0)).address;

        expect(wallet.address()).to.eq(expectedAddress);
    });

    it('should return consistently derived wallets', async () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        (await generator.next()).value;
        (await generator.next()).value;
        (await generator.next()).value;
        const expectedWallet = (await generator.next()).value;

        const generator2 = createWalletGenerator(MNEMONIC, 3);
        const actualWallet = (await generator2.next()).value;

        expect(expectedWallet.address).to.eq(actualWallet.address);
    });

    it('should return wallets with provider', async () => {
        const generator = createWalletGenerator(MNEMONIC, 0);
        const wallet = (await generator.next()).value;

        expect(wallet.provider).to.not.be.undefined;
    });
});

describe('generateWallets', () => {
    it('should return expected number of wallets with given generator', async () => {
        const testCounts = [0, 4, 10];
        const generator = createWalletGenerator(MNEMONIC, 0);
        for (const expectedWalletCount of testCounts) {
            const wallets = await generateWallets(expectedWalletCount, generator);

            expect(wallets.length).to.eq(expectedWalletCount);
        }
    });
});

describe('deriveWallets', () => {
    it('should return expected number of wallets', async () => {
        const testCounts = [0, 4, 10];

        testCounts.forEach(async (expectedWalletCount) => {
            let wallets = await deriveWallets(MNEMONIC, expectedWalletCount);

            expect(wallets.length).to.eq(expectedWalletCount);
        });
    });

    it('should return wallet derived from given mnemonic', async () => {
        const numberOfWallets = 5;
        const wallets = await deriveWallets(MNEMONIC, numberOfWallets);
        wallets.forEach((wallet, i) => {
            const expectedAddress = EthersWallet.fromMnemonic(MNEMONIC, getAccountPath(i)).address;

            expect(wallet.address()).to.eq(expectedAddress);
        });
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
