import { setupSimulation } from './simulations/setup';
import { runDepositSimulation } from './simulations/deposit';
import { runTransferToNewSimulation } from './simulations/transferToNew';
import config from './utils/config.utils';

// FIXME: this is a workaround for the fact that the simulation tool is not yet ready to run multiple simulations in parallel
(async function () {
    const tasks = [runDepositSimulation, runTransferToNewSimulation];

    config.totalRunningTimeSeconds = config.totalRunningTimeSeconds / tasks.length;
    const simulationSetup = await setupSimulation();

    for (const task of tasks) {
        await task(simulationSetup);
    }
})();
