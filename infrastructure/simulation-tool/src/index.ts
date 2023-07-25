import { setupSimulation } from './simulations/setup';
import { runDepositSimulation } from './simulations/deposit';
import { runTransferToNewSimulation } from './simulations/transferToNew';
import config from './utils/config.utils';

(async function () {
    const tasks = [runDepositSimulation, runTransferToNewSimulation];

    config.totalRunningTimeSeconds = config.totalRunningTimeSeconds / tasks.length;
    const simulationSetup = await setupSimulation();

    for (const task of tasks) {
        await task(simulationSetup);
    }
})();
