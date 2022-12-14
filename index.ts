import { TezosToolkit } from "@taquito/taquito";
import { DekuPClient } from "@marigold-dev/deku";
import Config from "./src/config";
import Tester from "./src/tester";

function changeVmNumber(str: string, vmNumber: number) {
  return str.replace(/vm\d+/g, "vm" + vmNumber);
}

async function main(): Promise<void> {
  const config = Config.load();
  const tezos = new TezosToolkit(config.TEZOS_URL);
  const data = `${Buffer.from(config.DATA).toString("hex")}`;

  for (;;) {
    const dekuNode = config.TEST_WITH_X_RAND_NODES
      ? changeVmNumber(
          config.DEKU_NODE,
          Math.floor(Math.random() * config.TEST_WITH_X_RAND_NODES)
        )
      : config.DEKU_NODE;

    const deku = new DekuPClient({
      dekuRpc: dekuNode,
    }).setTezosRpc(config.TEZOS_URL);

    console.log(`We are going to use the Deku Node: ${dekuNode}`);
    try {
      await Tester.loop(config, tezos, deku, data);
    } catch (e) {
      console.log(e);
      Tester.raiseError("Something wrong, please check the logs");
      return process.exit(1);
    }
  }
}

main().catch(console.error);
