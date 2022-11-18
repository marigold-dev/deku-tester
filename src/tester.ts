import { DekuToolkit, fromMemorySigner } from "@marigold-dev/deku-toolkit";
import { InMemorySigner } from "@taquito/signer";
import { MichelCodecPacker, TezosToolkit } from "@taquito/taquito";
import Config from "./config";
import Utils from "./utils";

namespace Tester {
  export async function raiseError(msg: string | unknown) {
    console.log("ERROR: ", msg);
    console.log(JSON.stringify(msg, null, 4));
  }

  export async function loop(
    config: Config.Variables,
    tezos: TezosToolkit,
    deku: DekuToolkit,
    data: string
  ) {
    tezos.setPackerProvider(new MichelCodecPacker());
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

      await Utils.sleep(1 * i);
    }

    // ASSERT Alice (Deku) balance is greater than before
    if (!newAliceBalance || aliceBalance >= newAliceBalance) {
      await raiseError(`Balance is not updated!`);
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
      await Utils.sleep(1 * i);
    }

    // ASSERT Bob (Deku) balance is greater than before
    if (!newBobBalance || bobBalance >= newBobBalance) {
      await raiseError(`Balance is not updated!`);
      return;
    }

    // TODO:
    // Bob (Deku) withdraw to Tezos
    //tezos.setProvider({
    //  signer: new InMemorySigner(config.BOB_PRIVATE_KEY),
    //});
    //const dekuBalance = new BigNumber(
    //  await deku.getBalance(config.BOB_PUBLIC_KEY, {
    //    ticketer: config.DUMMY_CONTRACT_ADDRESS,
    //    data,
    //  })
    //);
    //let decimals = Math.pow(10, 6);
    //console.log(`Deku balance before: ${dekuBalance}`);
    //const dekuBob = deku.setDekuSigner(bobDekuSigner);
    //const bobWithdrawToTezosOperation = await dekuBob.withdrawTo(
    //  config.BOB_PUBLIC_KEY,
    //  // config.AMMOUT_OF_TICKETS * decimals,
    //  1,
    //  config.DUMMY_CONTRACT_ADDRESS,
    //  data
    //);

    //await Utils.sleep(10);

    //const withdrawProof = await deku.getProof(bobWithdrawToTezosOperation);
    //if (!withdrawProof.handle.ticket_id) {
    //  await raiseError(`Withdraw proof not created correctly!`);
    //  return;
    //}

    //console.log("AAAAAAAAAAAAAAAAAAAAA");
    //console.log(withdrawProof);

    //console.log("BBBBBBBBBBBBBBBBBBBBBB");
    //console.log(withdrawProof.proof);

    //const concesusContract = await tezos.wallet.at(info.consensus);
    //// THIS IS FROM TZPORTAL
    //let proofPair: Array<[string, string]> = [];
    //for (var i = 0; i < withdrawProof.proof.length; i = i + 2) {
    //  proofPair.push([
    //    withdrawProof.proof[i].replace("0x", ""),
    //    withdrawProof.proof[i + 1].replace("0x", ""),
    //  ]);
    //}

    //// const params = new ParametersDEKU(
    ////   config.DUMMY_CONTRACT_ADDRESS,
    ////   // + "%withdraw_from_deku",
    ////   parseFloat(withdrawProof.handle.amount),
    ////   withdrawProof.handle.ticket_id.data,
    ////   withdrawProof.handle.id,
    ////   withdrawProof.handle.owner,
    ////   withdrawProof.handle.ticket_id.ticketer,
    ////   withdrawProof.withdrawal_handles_hash,
    ////   withdrawProof.proof as unknown as Array<[string, string]>
    ////   // proofPair
    //// );
    ////

    //// const params = [
    ////   config.DUMMY_CONTRACT_ADDRESS + "%withdraw_from_deku",
    ////   parseFloat(withdrawProof.handle.amount),
    ////   withdrawProof.handle.ticket_id.data,
    ////   withdrawProof.handle.id,
    ////   withdrawProof.handle.owner,
    ////   withdrawProof.handle.ticket_id.ticketer,
    ////   withdrawProof.withdrawal_handles_hash.startsWith("0x")
    ////     ? withdrawProof.withdrawal_handles_hash.substring(2)
    ////     : withdrawProof.withdrawal_handles_hash, //removes 0x if exists
    ////   proofPair,
    //// ];
    //const params = [
    //  info.consensus,
    //  parseFloat(withdrawProof.handle.amount),
    //  withdrawProof.handle.ticket_id.data,
    //  withdrawProof.handle.id,
    //  withdrawProof.handle.owner,
    //  withdrawProof.handle.ticket_id.ticketer,
    //  withdrawProof.withdrawal_handles_hash.startsWith("0x")
    //    ? withdrawProof.withdrawal_handles_hash.substring(2)
    //    : withdrawProof.withdrawal_handles_hash, //removes 0x if exists
    //  proofPair,
    //];

    //console.log(params);

    //console.log(
    //  `Inspect the signature of the 'withdraw' contract method: ${JSON.stringify(
    //    concesusContract.methods.withdraw().getSignature(),
    //    null,
    //    2
    //  )}`
    //);

    //console.log(
    //  `DUMMY Inspect the signature of the 'withdraw' contract method: ${JSON.stringify(
    //    dummy_contract.methods.withdraw_from_deku().getSignature(),
    //    null,
    //    2
    //  )}`
    //);

    //// const op = await concesusContract.methods.withdraw(...params).send();
    //const op = await dummy_contract.methods
    //  .withdraw_from_deku(
    //    info.consensus,
    //    parseFloat(withdrawProof.handle.amount),
    //    withdrawProof.handle.ticket_id.data,
    //    withdrawProof.handle.id,
    //    withdrawProof.handle.owner,
    //    withdrawProof.handle.ticket_id.ticketer,
    //    withdrawProof.withdrawal_handles_hash.startsWith("0x")
    //      ? withdrawProof.withdrawal_handles_hash.substring(2)
    //      : withdrawProof.withdrawal_handles_hash, //removes 0x if exists
    //    proofPair
    //  )
    //  .send();
    //await op.confirmation(3);

    //// // ASSET Bob (Tezos) balance
    //const bobTezosBalance = await tezos.tz.getBalance(config.BOB_PUBLIC_KEY);
    //const bobTezosBalanceInTez = tezos.format("mutez", "tz", bobTezosBalance);
    //console.log(`Bob Tezos final balance: ${bobTezosBalanceInTez}`);

    //if (bobTezosBalance.toNumber() <= bobTezosBalanceInTez) {
    //  await raiseError(`Balance is not updated!`);
    //  return;
    //}
  }
}

export default Tester;
