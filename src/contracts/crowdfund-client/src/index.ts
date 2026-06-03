import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAWEYJTWBGTN32GTF7GOJZIUCAD33M7EUDZCVBHSKKNYE5ZQS4GGLG5D",
  }
} as const



export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fund: ({donor, amount}: {donor: string, amount: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({target, deadline}: {target: u32, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAACUZ1bmRFdmVudAAAAAAAAAEAAAAKZnVuZF9ldmVudAAAAAAABAAAAAAAAAAFZG9ub3IAAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAAEAAAAAAAAAAAAAAAMdG90YWxfcmFpc2VkAAAABAAAAAAAAAAAAAAABnRhcmdldAAAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACkNsYWltRXZlbnQAAAAAAAEAAAALY2xhaW1fZXZlbnQAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAAAAAAMdG90YWxfcmFpc2VkAAAABAAAAAAAAAAAAAAABnRhcmdldAAAAAAABAAAAAAAAAAC",
        "AAAAAAAAAAAAAAAEZnVuZAAAAAIAAAAAAAAABWRvbm9yAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAAEAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAABA==",
        "AAAAAAAAAAAAAAAKZ2V0X3N0YXR1cwAAAAAAAAAAAAEAAAPqAAAABA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAGdGFyZ2V0AAAAAAAEAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<u32>,
        claim: this.txFromJSON<u32>,
        get_status: this.txFromJSON<Array<u32>>,
        initialize: this.txFromJSON<null>
  }
}