import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { expect, use } from 'chai';
import { ContractReceipt, Wallet as EthersWallet, constants } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import config from '../../src/config';
import { depositToSelf } from '../../src/simulations/deposit';

use(sinonChai);

describe('depositToSelf', () => {
    it('should execute deposit against own address', async () => {
        const l1wallet = sinon.createStubInstance(EthersWallet);
        const l2wallet = sinon.createStubInstance(RollupWallet);
        l2wallet.depositToSyncFromRootstock.callsFake(() =>
            Promise.resolve(sinon.createStubInstance(RootstockOperation))
        );
        await depositToSelf(l1wallet, l2wallet);

        expect(l2wallet.depositToSyncFromRootstock).to.have.been.calledOnce;
    });
});
