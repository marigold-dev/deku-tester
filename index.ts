import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const config = {
  ALICE_PRIVATE_KEY: process.env.ALICE_PRIVATE_KEY!,
  BOB_PRIVATE_KEY: process.env.BOB_PRIVATE_KEY!,
  DEKU_NODE: process.env.DEKU_NODE!,
  DEKU_USER_ADDRESS: process.env.DEKU_USER_ADDRESS!,
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
    : 20,
};

const Tezos = new TezosToolkit(config.TEZOS_URL);
Tezos.setProvider({
  signer: new InMemorySigner(config.ALICE_PRIVATE_KEY),
});

async function getBalance(data: string): Promise<number> {
  const url = `${config.DEKU_NODE}/api/v1/balance/${config.DEKU_USER_ADDRESS}/${config.DUMMY_CONTRACT_ADDRESS}/${data}`;
  const balanceResponse = await axios.get(url);
  return balanceResponse.data.balance;
}

async function sendToSlack(msg: string) {
  // TODO: use alert manager instead
  const messageWithPrefix = `${config.ALERT_MSG_PREFIX}: ${msg}`;
  console.log(messageWithPrefix);
  return await axios.post(config.SLACK_URL, {
    text: messageWithPrefix,
  });
}

type DekuInfo = { consensus: string };

async function getDeku() {
  const dekuInfo = await axios.get(`${config.DEKU_NODE}/api/v1/chain/info`);
  return dekuInfo.data as DekuInfo;
}

async function loop() {
  const dekuInfo = await getDeku();
  // Get the Deku balance to compare soon
  const data = `0x${Buffer.from(config.DATA).toString("hex")}`;
  console.log(`Getting balance for ${data}`);
  const balance: number = await getBalance(data);
  console.log(`Balance before: ${balance}`);

  // Call the dummy contract (create the tickets and sent to deku)
  const contract = await Tezos.contract.at(config.DUMMY_CONTRACT_ADDRESS!);
  const op = await contract.methods
    .mint_to_deku(
      dekuInfo.consensus, // deku concesus contract
      config.DEKU_USER_ADDRESS, // recipient, public key hash
      config.AMMOUT_OF_TICKETS, // amount of tickets
      data // bytes
    )
    .send();
  await op.confirmation(config.CONFIRMATION);
  console.log("Minted to deku!");

  // Incremental loop to check the balance
  let newBalance = undefined;
  for (let i = 1; i <= config.MAX_ATTEMPTS; i++) {
    newBalance = await getBalance(data);
    console.log(
      `Balance after: ${newBalance} - Attempt: ${i} of ${config.MAX_ATTEMPTS}`
    );

    if (newBalance > balance) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * i));
  }

  // ASSERT
  if (!newBalance || balance >= newBalance) {
    sendToSlack(`Balance is not updated!`);
  }
}

async function main(): Promise<void> {
  for (;;) {
    try {
      await loop();
    } catch (e) {
      await new Promise((res) => setTimeout(res, 300000));
    }
  }
}

main().catch(console.error);
