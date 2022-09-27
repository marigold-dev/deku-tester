import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const config = {
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY!,
  DEKU_NODE: process.env.DEKU_NODE!,
  DEKU_USER_ADDRESS: process.env.DEKU_USER_ADDRESS!,
  DEKU_CONSENSUS_ADDRESS: process.env.DEKU_CONSENSUS_ADDRESS!,
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
  TEZOS_URL: process.env.TEZOS_URL || "https://ghostnet.tezos.marigold.dev/",
  MAX_ATTEMPTS: process.env.MAX_ATTEMPTS
    ? parseInt(process.env.MAX_ATTEMPTS)
    : 10,
};

const Tezos = new TezosToolkit(config.TEZOS_URL);
Tezos.setProvider({
  signer: new InMemorySigner(config.WALLET_PRIVATE_KEY),
});

async function getBalance(data: string): Promise<number> {
  const balanceResponse = await axios.get(
    `${config.DEKU_NODE}/api/v1/balance/${config.DEKU_USER_ADDRESS}/${config.DUMMY_CONTRACT_ADDRESS}/${data}`
  );
  return balanceResponse.data.balance;
}

async function sendToSlack(msg: string) {
  // TODO: use alert manager instead
  return await axios.post(config.SLACK_URL, {
    text: `${config.ALERT_MSG_PREFIX}: ${msg}`,
  });
}

async function loop() {
  // Get the Deku balance to compare soon
  const data = `0x${Buffer.from(config.DATA).toString("hex")}`;
  const balance: number = await getBalance(data);
  console.log(`Balance before: ${balance}`);

  // Call the dummy contract (create the tickets and sent to deku)
  const contract = await Tezos.contract.at(config.DUMMY_CONTRACT_ADDRESS!);
  const op = await contract.methods
    .mint_to_deku(
      config.DEKU_CONSENSUS_ADDRESS, // deku concesus contract
      config.DEKU_USER_ADDRESS, // recipient, public key hash
      config.AMMOUT_OF_TICKETS, // amount of tickets
      data // bytes
    )
    .send();
  await op.confirmation(config.CONFIRMATION);
  console.log("Minted to deku!");

  // Incremental loop to check the balance
  const newBalance = undefined;
  for (let i = 1; i <= config.MAX_ATTEMPTS; i++) {
    const newBalance: number = await getBalance(data);
    console.log(
      `Balance after: ${balance} - Attempt: ${i} of ${config.MAX_ATTEMPTS}`
    );
    if (balance === newBalance) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * i));
    }
  }

  // ASSERT
  if (!newBalance || balance >= newBalance) {
    await sendToSlack(`Balance is not updated!`);
  }
}

async function main(): Promise<void> {
  for (;;) {
    try {
      await loop();
    } catch (e) {
      await sendToSlack(`Error: ${e}`);
      await new Promise((res) => setTimeout(res, 300000));
    }
  }
}

main().catch(console.error);
