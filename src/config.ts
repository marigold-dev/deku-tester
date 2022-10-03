import * as dotenv from "dotenv";

namespace Config {
  export type Variables = ReturnType<typeof load>;

  export function load() {
    dotenv.config();
    const MY_CONST = {
      ALICE_PRIVATE_KEY: process.env.ALICE_PRIVATE_KEY!,
      BOB_PRIVATE_KEY: process.env.BOB_PRIVATE_KEY!,
      ALICE_PUBLIC_KEY: process.env.ALICE_PUBLIC_KEY!,
      BOB_PUBLIC_KEY: process.env.BOB_PUBLIC_KEY!,
      DEKU_NODE:
        process.env.DEKU_NODE ||
        "https://deku-canonical-vm0.deku-v1.marigold.dev",
      TEST_WITH_X_RAND_NODES: process.env.TEST_MULTIPLES_NODES
        ? parseInt(process.env.TEST_MULTIPLES_NODES)
        : 4,
      DUMMY_CONTRACT_ADDRESS: process.env.DUMMY_CONTRACT_ADDRESS!,
      AMMOUT_OF_TICKETS: process.env.AMMOUT_OF_TICKETS
        ? parseInt(process.env.AMMOUT_OF_TICKETS)
        : 100,
      DATA: process.env.DATA || "hello world",
      SLACK_URL: process.env.SLACK_URL!,
      ALERT_MSG_PREFIX: process.env.ALERT_MSG_PREFIX || "DEKU_TESTER",
      CONFIRMATION: process.env.CONFIRMATION
        ? parseInt(process.env.CONFIRMATION)
        : 2,
      TEZOS_URL:
        process.env.TEZOS_URL || "https://ghostnet.tezos.marigold.dev/",
      MAX_ATTEMPTS: process.env.MAX_ATTEMPTS
        ? parseInt(process.env.MAX_ATTEMPTS)
        : 20,
      ENABLE_ALERTS: process.env.ENABLE_ALERTS === "false" ? false : true,
    };
    return MY_CONST;
  }
}

export default Config;
