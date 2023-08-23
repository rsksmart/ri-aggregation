import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
    PreparedPubKeyChange,
    executePubKeyChange,
    executePubKeyChanges,
    generatePubKeyChanges,
    preparePubKeyChange,
    resolveTransaction,
    resolvePubKeyChanges,
    ResolvedPubKeyChange
} from '../../src/operations/changePubKey';
import { expect, use } from 'chai';
import { constants } from 'ethers';
import { RollupWalletGenerator } from '../../src/utils/wallet.utils';

use(sinonChai);

describe('changePubKey', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('preparePubKeyChange', () => {
        let senderWallet: RollupWallet;
        beforeEach(() => {
            senderWallet = sinon.createStubInstance(RollupWallet);
        });
        it('should return object with "from" set to the sender parameter', () => {
            const expectedSender = senderWallet;
            const { from } = preparePubKeyChange(expectedSender);

            expect(from).to.equal(expectedSender);
        });

        it('should return object with "ethAuthType" set to "ECDSA"', () => {
            const expectedValue = 'ECDSA';
            const { ethAuthType } = preparePubKeyChange(senderWallet);

            expect(ethAuthType).to.equal(expectedValue);
        });

        it('should return object with "feeToken" set to RBTC', () => {
            const expectedFeeToken = 'RBTC';
            const { feeToken } = preparePubKeyChange(senderWallet);

            expect(feeToken).to.equal(expectedFeeToken);
        });
    });

    describe('generatePubKeyChanges', () => {
        it(`should return given number of objects`, async () => {
            const walletGenerator: RollupWalletGenerator = {
                next: sinon.stub().resolves({ value: sinon.createStubInstance(RollupWallet) })
            } as unknown as RollupWalletGenerator;
            const expectedCount = 12;
            const { length: actualCount } = await generatePubKeyChanges(expectedCount, walletGenerator);

            expect(actualCount).to.equal(expectedCount);
        });

        it('should only return objects for accounts without signing key already set', async () => {
            const txCount = 12;
            const keysSetIndexes = [9, 3, 7];
            let genCount = 0;
            const createWalletStub = (i: number) => {
                if (genCount > txCount + keysSetIndexes.length) {
                    throw Error('Halting problem detected.');
                }

                const stub = sinon.createStubInstance(RollupWallet);
                stub.isSigningKeySet.resolves(keysSetIndexes.includes(i));

                return stub;
            };

            const walletGenerator: RollupWalletGenerator = {
                next: sinon.stub().callsFake(() => Promise.resolve({ value: createWalletStub(genCount++) }))
            } as unknown as RollupWalletGenerator;

            const results = await generatePubKeyChanges(txCount, walletGenerator);
            const actualResults = await Promise.all(results.map(({ from }) => from.isSigningKeySet()));

            expect(walletGenerator.next).to.have.callCount(txCount + keysSetIndexes.length);
            expect(actualResults).to.not.include(true);
        });
    });

    describe('executePubKeyChange', async () => {
        it('should call setSigningKey on given wallet with given parameters', async () => {
            const senderWallet = sinon.createStubInstance(RollupWallet);
            const expectedParameters: Omit<PreparedPubKeyChange, 'from'> = {
                ethAuthType: 'ECDSA',
                feeToken: constants.AddressZero
            };
            await executePubKeyChange({ from: senderWallet, ...expectedParameters });

            expect(senderWallet.setSigningKey).to.have.been.calledWith(expectedParameters);
        });
    });

    describe('executePubKeyChanges', async () => {
        it('should call executePubKeyChange for each given preparedPubKeyChange', async () => {
            const senderWallet = sinon.createStubInstance(RollupWallet);
            const preparedPubKeyChanges: PreparedPubKeyChange[] = [
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero }
            ];

            await executePubKeyChanges(preparedPubKeyChanges, 0);

            expect(senderWallet.setSigningKey).to.have.been.calledThrice;
        });

        it('should call executePubKeyChange with given delay between calls', async () => {
            const senderWallet = sinon.createStubInstance(RollupWallet);
            const preparedPubKeyChanges: PreparedPubKeyChange[] = [
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero }
            ];
            const delay = 100;
            const expectedTotalTime = delay * (preparedPubKeyChanges.length - 1);

            const startTime = Date.now();
            await executePubKeyChanges(preparedPubKeyChanges, delay);
            const endTime = Date.now();

            const actualTotalTime = endTime - startTime;
            expect(actualTotalTime).to.be.greaterThan(expectedTotalTime);
        });

        it('should return array of promises', async () => {
            const senderWallet = sinon.createStubInstance(RollupWallet);
            const preparedPubKeyChanges: PreparedPubKeyChange[] = [
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero }
            ];

            const actualResults = await executePubKeyChanges(preparedPubKeyChanges, 0);

            const allResultsAreTransactions = actualResults.every((result) => result instanceof Promise);

            expect(allResultsAreTransactions).to.be.true;
        });

        it('should return array of promised transactions', async () => {
            const senderWallet = sinon.createStubInstance(RollupWallet);
            senderWallet.setSigningKey.resolves(sinon.createStubInstance(Transaction));
            const preparedPubKeyChanges: PreparedPubKeyChange[] = [
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero },
                { from: senderWallet, ethAuthType: 'ECDSA', feeToken: constants.AddressZero }
            ];

            const actualResults = await Promise.all(
                (await executePubKeyChanges(preparedPubKeyChanges, 0)).map(async (tx) => await tx)
            );

            const allResultsAreTransactions = actualResults.every((result) => result instanceof Transaction);

            expect(allResultsAreTransactions).to.be.true;
        });
    });

    describe('resolveTransaction', async () => {
        it('should return object with tx, receipt and verifyReceipt', async () => {
            const expectedReceipt = {
                success: true,
                executed: false
            };
            const tx = sinon.createStubInstance(Transaction);
            tx.awaitReceipt.resolves(expectedReceipt);
            tx.awaitVerifyReceipt.resolves(expectedReceipt);

            const { tx: actualTx, receipt, verifyReceipt } = await resolveTransaction(tx);

            expect(actualTx).to.equal(tx);
            expect(receipt).to.equal(expectedReceipt);
            expect(verifyReceipt).to.equal(null); // expecting null for now, see implementation
        });
    });

    describe('resolvePubKeyChanges', async () => {
        it('should return array of Results', async () => {
            const txCount = 12;
            const txs = Array.from({ length: txCount }, () => sinon.createStubInstance(Transaction));

            const actualResults: ResolvedPubKeyChange[] = await resolvePubKeyChanges(txs);

            for (const result of actualResults) {
                expect(result).to.have.property('tx');
                expect(result).to.have.property('receipt');
                expect(result).to.have.property('verifyReceipt');
            }
        });

        it('should return array of same size ', async () => {
            const txCount = 12;
            const txs = Array.from({ length: txCount }, () => sinon.createStubInstance(Transaction));
            const actualResults = await resolvePubKeyChanges(txs);

            expect(actualResults).to.have.lengthOf(txCount);
        });
    });
});
