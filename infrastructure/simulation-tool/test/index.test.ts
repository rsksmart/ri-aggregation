import { use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

use(sinonChai);

afterEach(() => {
    sinon.reset();
    sinon.restore();
});
