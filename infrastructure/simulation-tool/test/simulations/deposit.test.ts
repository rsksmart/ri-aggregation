import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { expect, use } from 'chai';
import { BigNumber } from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { depositToSelf } from '../../src/operations/deposit';

use(sinonChai);
