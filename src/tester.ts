import { DekuToolkit, fromMemorySigner } from "@marigold-dev/deku-toolkit";
import { InMemorySigner } from "@taquito/signer";
import { MichelCodecPacker, TezosToolkit } from "@taquito/taquito";
import { PackDataParams } from "@taquito/rpc";
import axios from "axios";
import Config from "./config";
import Utils from "./utils";
import BigNumber from "bignumber.js";
import { RollupParametersDEKU } from "./rollup";

namespace Tester {
  export async function sendToSlack(config: Config.Variables, msg: string | unknown) {
    console.log(msg);
    // TODO: use alert manager instead
    const messageWithPrefix = `${config.ALERT_MSG_PREFIX}: ${msg}`;
    if (config.ENABLE_ALERTS) {
      return await axios.post(config.SLACK_URL, {
        text: messageWithPrefix,
      });
    }
  }

  export async function getXTZBytes(): Promise<string> {
    const p = new MichelCodecPacker();
    let XTZbytes: PackDataParams = {
      data: { prim: "Left", args: [{ prim: "Unit" }] },
      type: {
        prim: "Or",
        args: [
          { prim: "Unit", annots: ["%XTZ"] },
          { prim: "Address", annots: ["%FA"] },
        ],
      },
    };
    return (await p.packData(XTZbytes)).packed;
  }

  export async function loop(
    config: Config.Variables,
    tezos: TezosToolkit,
    deku: DekuToolkit,
    data: string
  ) {
    const aliceDekuSigner = fromMemorySigner(
      new InMemorySigner(config.ALICE_PRIVATE_KEY)
    );
    const bobDekuSigner = fromMemorySigner(
      new InMemorySigner(config.BOB_PRIVATE_KEY)
    );

    deku.setDekuSigner(aliceDekuSigner);

    tezos.setProvider({
      signer: new InMemorySigner(config.ALICE_PRIVATE_KEY),
    });

    const info = await deku.info();
    console.log(`Using the consensus address: ${info.consensus}`);

    // Get the Deku balance to compare soon
    // TODO: Improve this
    console.log(`Getting balance for ${data}`);
    const aliceBalance = await deku.getBalance(config.ALICE_PUBLIC_KEY, {
      ticketer: config.DUMMY_CONTRACT_ADDRESS,
      data,
    });
    console.log(`Alice Balance before: ${aliceBalance}`);

    // Alice (Tezos) call the dummy contract (create the tickets and sent to deku)
    // TODO: I think that deku-toolkit should do that.
    const dummy_contract = await tezos.contract.at(
      config.DUMMY_CONTRACT_ADDRESS!
    );
    const aliceDepositDekuOP = await dummy_contract.methods
      .mint_to_deku(
        info.consensus, // deku concesus contract
        config.ALICE_PUBLIC_KEY, // recipient, public key hash
        config.AMMOUT_OF_TICKETS, // amount of tickets
        data // bytes
      )
      .send();
    await aliceDepositDekuOP.confirmation(config.CONFIRMATION);
    console.log("Alice minted to deku!");

    // Incremental loop to check the balance
    let newAliceBalance = undefined;
    for (let i = 1; i <= config.MAX_ATTEMPTS; i++) {
      newAliceBalance = await deku.getBalance(config.ALICE_PUBLIC_KEY, {
        ticketer: config.DUMMY_CONTRACT_ADDRESS,
        data,
      });
      console.log(
        `Balance after: ${newAliceBalance} - Attempt: ${i} of ${config.MAX_ATTEMPTS}`
      );

      if (newAliceBalance > aliceBalance) {
        break;
      }
      await Utils.sleep(1);
    }

    // ASSERT Alice (Deku) balance is greater than before
    if (!newAliceBalance || aliceBalance >= newAliceBalance) {
      await sendToSlack(config, `Balance is not updated!`);
      return;
    }

    // Check Bob (Deku) balance
    const bobBalance = await deku.getBalance(config.BOB_PUBLIC_KEY, {
      ticketer: config.DUMMY_CONTRACT_ADDRESS,
      data,
    });
    console.log(`Bob balance before: ${bobBalance}`);

    // Alice (Deku) tranfer to Bob (Deku)
    const aliceToBobOperation = await deku.transferTo(
      config.BOB_PUBLIC_KEY,
      config.AMMOUT_OF_TICKETS,
      config.DUMMY_CONTRACT_ADDRESS,
      data
    );
    console.log("Alice transfered to Bob!");

    // Incremental loop to check the balance
    let newBobBalance = undefined;
    for (let i = 1; i <= config.MAX_ATTEMPTS; i++) {
      newBobBalance = await deku.getBalance(config.BOB_PUBLIC_KEY, {
        ticketer: config.DUMMY_CONTRACT_ADDRESS,
        data,
      });
      console.log(
        `Balance after: ${newBobBalance} - Attempt: ${i} of ${config.MAX_ATTEMPTS}`
      );

      if (newBobBalance > bobBalance) {
        break;
      }
      await Utils.sleep(1);
    }

    // ASSERT Bob (Deku) balance is greater than before
    if (!newBobBalance || bobBalance >= newBobBalance) {
      await sendToSlack(config, `Balance is not updated!`);
      return;
    }

    // Bob (Deku) withdraw to Tezos
    const dekuBalance = new BigNumber(
      await deku.getBalance(config.BOB_PUBLIC_KEY, {
        ticketer: config.DUMMY_CONTRACT_ADDRESS,
        data,
      })
    );
    let decimals = Math.pow(10, 6);
    console.log(`Deku balance before: ${dekuBalance}`);
    const dekuBob = deku.setDekuSigner(bobDekuSigner);
    const bobWithdrawToTezosOperation = await dekuBob.withdrawTo(
      config.BOB_PUBLIC_KEY,
      // config.AMMOUT_OF_TICKETS * decimals,
      1,
      config.DUMMY_CONTRACT_ADDRESS,
      data
    );

    await Utils.sleep(10);

    const withdrawProof = await deku.getProof(bobWithdrawToTezosOperation);
    if (!withdrawProof.handle.ticket_id) {
      await sendToSlack(config, `Withdraw proof not created correctly!`);
      return;
    }

    console.log("AAAAAAAAAAAAAAAAAAAAA")
    console.log(withdrawProof);

    console.log("BBBBBBBBBBBBBBBBBBBBBB")
    console.log(withdrawProof.proof)

    const concesusContract = await tezos.wallet.at(info.consensus);
    // THIS IS FROM TZPORTAL
    // let proofPair: Array<[string, string]> = [];
    // for (var i = 0; i < withdrawProof.proof.length; i = i + 2) {
    //   proofPair.push([
    //     withdrawProof.proof[i].replace("0x", ""),
    //     withdrawProof.proof[i + 1].replace("0x", ""),
    //   ]);
    // }

    const params = new RollupParametersDEKU(
      config.DUMMY_CONTRACT_ADDRESS + "%withdraw_from_deku",
      parseFloat(withdrawProof.handle.amount),
      withdrawProof.handle.ticket_id.data,
      withdrawProof.handle.id,
      withdrawProof.handle.owner,
      withdrawProof.handle.ticket_id.ticketer,
      withdrawProof.withdrawal_handles_hash,
      withdrawProof.proof as unknown as Array<[string, string]>
      // proofPair
    );

    const withdrawParams = Object.values(params) 
    console.log(withdrawParams);

    const op = await concesusContract.methods.withdraw(...withdrawParams).send();
    await op.confirmation(3);

    // // ASSET Bob (Tezos) balance
    const bobTezosBalance = await tezos.tz.getBalance(config.BOB_PUBLIC_KEY);
    const bobTezosBalanceInTez = tezos.format("mutez", "tz", bobTezosBalance);
    console.log(`Bob Tezos final balance: ${bobTezosBalanceInTez}`);

    if (bobTezosBalance.toNumber() <= bobTezosBalanceInTez) {
      await sendToSlack(config, `Balance is not updated!`);
      return;
    }
  }
}

export default Tester;
