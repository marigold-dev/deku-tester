import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import chalk from "chalk";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const ghostnet = "https://ghostnet.tezos.marigold.dev/";
const Tezos = new TezosToolkit(ghostnet);
Tezos.setProvider({
  signer: new InMemorySigner(process.env.WALLET_PRIVATE_KEY!),
});

async function getBalance(data: string): Promise<number> {
  const balanceResponse = await axios.get(
    `${process.env.DEKU_NODE}/api/v1/balance/${process.env.DEKU_USER_ADDRESS}/${process.env.DUMMY_CONTRACT_ADDRESS}/${data}`
  );
  return balanceResponse.data.balance;
}

async function sentToSlack(msg: string) {
  return await axios.post(process.env.SLACK_URL!, { text: `DEKU_TESTER: ${msg}` });
}

async function loop() {
  // Get the Deku balance to compare soon
  const data = `0x${Buffer.from("hello world").toString("hex")}`;
  const balance: number = await getBalance(data);
  console.log(chalk.green(`Balance before: ${balance}`));

  // Call the dummy contract (create the tickets and sent to deku)
  const contract = await Tezos.contract.at(process.env.DUMMY_CONTRACT_ADDRESS!);
  const op = await contract.methods
    .mint_to_deku(
      process.env.DEKU_CONSENSUS_ADDRESS, // deku concesus contract
      process.env.DEKU_USER_ADDRESS, // recipient, public key hash
      100, // amount of tickets
      data // bytes
    )
    .send();
  await op.confirmation(2);
  console.log("Minted to deku!");
  // TODO: use a incremental for loop for that
  await new Promise((res) => setTimeout(res, 30000));

  // See the balance is updated
  const newBalance: number = await getBalance(data);
  console.log(chalk.green(`Balance after: ${newBalance}`));

  // ASSERT 
  if (newBalance <= balance) {
	await sentToSlack(`Balance is not updated!`);
  }
}

async function main(): Promise<void> {
  for (;;) {
    try {
      await loop();
    } catch (e) {
      console.error(e);
      await sentToSlack(`Error: ${e}`);
    }
  }
}

main().catch(console.error);
