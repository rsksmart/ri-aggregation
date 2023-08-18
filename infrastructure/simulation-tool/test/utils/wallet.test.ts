import { Wallet as RollupWallet, SyncProvider as RollupProvider, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { Wallet as EthersWallet, providers } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    WalletGeneratorFactoryParams,
    activateL2Account,
    createWalletGenerator,
    deriveWallets,
    generateWallets,
    getAccountPath
} from '../../src/utils/wallet.utils';

use(sinonChai);

const mnemonic: string =
    'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';

let generatorParams: WalletGeneratorFactoryParams;
let l1WalletStub: EthersWallet;
let l2walletStub: RollupWallet;

beforeEach(() => {
    const l1ProviderStub = sinon.createStubInstance(providers.JsonRpcProvider);
    const l2ProviderStub = sinon.createStubInstance(RollupProvider);

    l1WalletStub = sinon.createStubInstance(EthersWallet, {
        connect: l1WalletStub
    });
    (<any>l1WalletStub).provider = l1ProviderStub;
    sinon.stub(EthersWallet, 'fromMnemonic').returns(l1WalletStub);
    l2walletStub = sinon.createStubInstance(RollupWallet, {
        ethSigner: l1WalletStub
    });
    sinon.stub(RollupWallet, 'fromEthSigner').resolves(l2walletStub);

    generatorParams = {
        mnemonic,
        l1Provider: l1ProviderStub,
        l2Provider: l2ProviderStub
    };
});

afterEach(() => {
    sinon.restore();
});
describe('createWalletGenerator', () => {
    it('should return a generator', () => {
        const generator = createWalletGenerator(generatorParams);

        expect(generator.next).to.be.a('function');
        expect(generator.return).to.be.a('function');
        expect(generator.throw).to.be.a('function');
    });

    it('should return a function that returns a derived wallet', async () => {
        const generator = createWalletGenerator(generatorParams);
        const wallet = (await generator.next()).value;
        const expectedAddress = EthersWallet.fromMnemonic(mnemonic, getAccountPath(0)).address;

        expect(wallet.address()).to.eq(expectedAddress);
    });

    it('should return consistently derived wallets', async () => {
        const generator = createWalletGenerator(generatorParams);
        (await generator.next()).value;
        (await generator.next()).value;
        (await generator.next()).value;
        const expectedWallet = (await generator.next()).value;

        const generator2 = createWalletGenerator(generatorParams);
        const actualWallet = (await generator2.next()).value;

        expect(expectedWallet.address).to.eq(actualWallet.address);
    });

    it('should return L2 wallet with l1 wallet with provider', async () => {
        const generator = createWalletGenerator(generatorParams);
        const wallet = (await generator.next()).value;
        const { l1Provider: expectedProvider } = generatorParams;

        expect(wallet.ethSigner().provider).to.equal(expectedProvider);
    });
});

describe('generateWallets', () => {
    it('should return expected number of wallets with given generator', async () => {
        const testCounts = [0, 4, 10];
        const generator = createWalletGenerator(generatorParams);
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
            let wallets = await deriveWallets(expectedWalletCount, generatorParams);

            expect(wallets.length).to.eq(expectedWalletCount);
        });
    });

    it('should return wallet derived from given mnemonic', async () => {
        const numberOfWallets = 5;
        const wallets = await deriveWallets(numberOfWallets, generatorParams);
        wallets.forEach((wallet, i) => {
            const expectedAddress = EthersWallet.fromMnemonic(mnemonic, getAccountPath(i)).address;

            expect(wallet.address()).to.eq(expectedAddress);
        });
    });
});

describe('activateL2Account', () => {
    it('should activate account', async () => {
        const walletStub = sinon.createStubInstance(RollupWallet);
        walletStub.setSigningKey.callsFake(() => {
            return Promise.resolve(sinon.createStubInstance(Transaction));
        });

        await activateL2Account(walletStub);

        expect(walletStub.setSigningKey).to.have.been.calledOnce;
    });
});
