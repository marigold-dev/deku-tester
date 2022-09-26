import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
// import axios from "axios";
import chalk from "chalk";
// import dayjs from "dayjs";

const mainnet = "https://mainnet.tezos.marigold.dev/";
const jakartanet = "https://jakartanet.tezos.marigold.dev/";
// const kathmandunet = "https://kathmandunet.tezos.marigold.dev/";
// const kathmandunet = "https://kathmandunet-1.tezos.marigold.dev/";
const ghostnet = "https://ghostnet.tezos.marigold.dev/";

// const Tezos = new TezosToolkit(ghostnet);
// Tezos.setProvider({
//   signer: new InMemorySigner(
//     "WALLET_PRIVATE_KEY"
//   ),
// });

async function main(): Promise<void> {
	console.log(chalk.green("Hello World!"));
}

main().catch(console.error);
