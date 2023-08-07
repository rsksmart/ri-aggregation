import { setupSimulation } from './simulations/setup';
import { runTransferToNewSimulation } from './simulations/transferToNew';
import config from './utils/config.utils';

// FIXME: this is a workaround for the fact that the simulation tool is not yet ready to run multiple simulations in parallel
(async function () {
    const tasks = [runTransferToNewSimulation];

    for (const task of tasks) {
        const simulationSetup = await setupSimulation();

        config.totalRunningTimeSeconds = Math.floor(config.totalRunningTimeSeconds / tasks.length);
        simulationSetup.txCount = Math.floor(simulationSetup.txCount / tasks.length);

        await task(simulationSetup);
    }
})();
