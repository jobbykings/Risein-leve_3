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
    // NOTE: this ID points at the ORIGINAL (pre-upgrade) deployment, whose
    // fund/claim signatures are incompatible with this client. Redeploy the
    // upgraded contract (see the repo README / deployment workflow), then
    // regenerate the bindings against the new contract and update this ID.
    contractId: "CDAZNHHPR7N72EXUOE2Y6GEVEPE2ZWV4G7NVHPKYWP63YTYHHRZZOKMV",
  },
} as const






/**
 * Typed contract errors returned instead of panicking.
 */
export const CrowdfundError = {
  0: {message:"NotInitialized"},
  1: {message:"AlreadyInitialized"},
  2: {message:"DeadlinePassed"},
  3: {message:"DeadlineNotPassed"},
  4: {message:"TargetNotMet"},
  5: {message:"AlreadyClaimed"},
  6: {message:"InvalidAmount"},
  7: {message:"Overflow"},
  8: {message:"NoFunds"}
}

export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Contribute `amount` (stroops) to the campaign. Transfers real XLM from
   * the `donor` to this contract via the configured Stellar Asset Contract
   * (an inter-contract call). Returns the new total raised.
   * 
   * Requires authorisation from `donor`.
   */
  fund: ({donor, amount}: {donor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim the raised funds once the deadline has passed **and** the target
   * has been reached. Pays out the contract's entire token balance to the
   * configured `beneficiary`. Any address may call this function (only one
   * claim is allowed).
   */
  claim: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read the current campaign status.
   * 
   * Returns a 5-element vector:
   * [0] total_raised (as u64)
   * [1] target       (as u64)
   * [2] deadline     (unix seconds)
   * [3] deadline_passed (1 = yes, 0 = no)
   * [4] is_claimed      (1 = yes, 0 = no)
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialise the crowdfund campaign with a funding `target` (in stroops),
   * a Unix-second `deadline` (ledger timestamp), the `beneficiary` address
   * that receives the raised funds on claim, and the `token` (SAC) address
   * that the campaign accepts (native XLM for this app).
   * 
   * Can only be called once — returns [`CrowdfundError::AlreadyInitialized`]
   * if the campaign was already initialised.
   */
  initialize: ({target, deadline, beneficiary, token}: {target: i128, deadline: u64, beneficiary: string, token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAABQAAACpFbWl0dGVkIGV2ZXJ5IHRpbWUgYSBjb250cmlidXRpb24gaXMgbWFkZS4AAAAAAAAAAAAJRnVuZEV2ZW50AAAAAAAAAQAAAApmdW5kX2V2ZW50AAAAAAAEAAAAAAAAAAVkb25vcgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAx0b3RhbF9yYWlzZWQAAAALAAAAAAAAAAAAAAAGdGFyZ2V0AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAEBFbWl0dGVkIHdoZW4gdGhlIGNhbXBhaWduIGZ1bmRzIGFyZSBwYWlkIG91dCB0byB0aGUgYmVuZWZpY2lhcnkuAAAAAAAAAApDbGFpbUV2ZW50AAAAAAABAAAAC2NsYWltX2V2ZW50AAAAAAUAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAAAAAAC2JlbmVmaWNpYXJ5AAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAx0b3RhbF9yYWlzZWQAAAALAAAAAAAAAAAAAAAGdGFyZ2V0AAAAAAALAAAAAAAAAAI=",
        "AAAABAAAADRUeXBlZCBjb250cmFjdCBlcnJvcnMgcmV0dXJuZWQgaW5zdGVhZCBvZiBwYW5pY2tpbmcuAAAAAAAAAA5Dcm93ZGZ1bmRFcnJvcgAAAAAACQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAORGVhZGxpbmVQYXNzZWQAAAAAAAIAAAAAAAAAEURlYWRsaW5lTm90UGFzc2VkAAAAAAAAAwAAAAAAAAAMVGFyZ2V0Tm90TWV0AAAABAAAAAAAAAAOQWxyZWFkeUNsYWltZWQAAAAAAAUAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAGAAAAAAAAAAhPdmVyZmxvdwAAAAcAAAAAAAAAB05vRnVuZHMAAAAACA==",
        "AAAAAAAAAOtDb250cmlidXRlIGBhbW91bnRgIChzdHJvb3BzKSB0byB0aGUgY2FtcGFpZ24uIFRyYW5zZmVycyByZWFsIFhMTSBmcm9tCnRoZSBgZG9ub3JgIHRvIHRoaXMgY29udHJhY3QgdmlhIHRoZSBjb25maWd1cmVkIFN0ZWxsYXIgQXNzZXQgQ29udHJhY3QKKGFuIGludGVyLWNvbnRyYWN0IGNhbGwpLiBSZXR1cm5zIHRoZSBuZXcgdG90YWwgcmFpc2VkLgoKUmVxdWlyZXMgYXV0aG9yaXNhdGlvbiBmcm9tIGBkb25vcmAuAAAAAARmdW5kAAAAAgAAAAAAAAAFZG9ub3IAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAfQAAAADkNyb3dkZnVuZEVycm9yAAA=",
        "AAAAAAAAAOZDbGFpbSB0aGUgcmFpc2VkIGZ1bmRzIG9uY2UgdGhlIGRlYWRsaW5lIGhhcyBwYXNzZWQgKiphbmQqKiB0aGUgdGFyZ2V0CmhhcyBiZWVuIHJlYWNoZWQuIFBheXMgb3V0IHRoZSBjb250cmFjdCdzIGVudGlyZSB0b2tlbiBiYWxhbmNlIHRvIHRoZQpjb25maWd1cmVkIGBiZW5lZmljaWFyeWAuIEFueSBhZGRyZXNzIG1heSBjYWxsIHRoaXMgZnVuY3Rpb24gKG9ubHkgb25lCmNsYWltIGlzIGFsbG93ZWQpLgAAAAAABWNsYWltAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAALAAAH0AAAAA5Dcm93ZGZ1bmRFcnJvcgAA",
        "AAAAAAAAAN5SZWFkIHRoZSBjdXJyZW50IGNhbXBhaWduIHN0YXR1cy4KClJldHVybnMgYSA1LWVsZW1lbnQgdmVjdG9yOgpbMF0gdG90YWxfcmFpc2VkIChhcyB1NjQpClsxXSB0YXJnZXQgICAgICAgKGFzIHU2NCkKWzJdIGRlYWRsaW5lICAgICAodW5peCBzZWNvbmRzKQpbM10gZGVhZGxpbmVfcGFzc2VkICgxID0geWVzLCAwID0gbm8pCls0XSBpc19jbGFpbWVkICAgICAgKDEgPSB5ZXMsIDAgPSBubykAAAAAAApnZXRfc3RhdHVzAAAAAAAAAAAAAQAAA+oAAAAG",
        "AAAAAAAAAX9Jbml0aWFsaXNlIHRoZSBjcm93ZGZ1bmQgY2FtcGFpZ24gd2l0aCBhIGZ1bmRpbmcgYHRhcmdldGAgKGluIHN0cm9vcHMpLAphIFVuaXgtc2Vjb25kIGBkZWFkbGluZWAgKGxlZGdlciB0aW1lc3RhbXApLCB0aGUgYGJlbmVmaWNpYXJ5YCBhZGRyZXNzCnRoYXQgcmVjZWl2ZXMgdGhlIHJhaXNlZCBmdW5kcyBvbiBjbGFpbSwgYW5kIHRoZSBgdG9rZW5gIChTQUMpIGFkZHJlc3MKdGhhdCB0aGUgY2FtcGFpZ24gYWNjZXB0cyAobmF0aXZlIFhMTSBmb3IgdGhpcyBhcHApLgoKQ2FuIG9ubHkgYmUgY2FsbGVkIG9uY2Ug4oCUIHJldHVybnMgW2BDcm93ZGZ1bmRFcnJvcjo6QWxyZWFkeUluaXRpYWxpemVkYF0KaWYgdGhlIGNhbXBhaWduIHdhcyBhbHJlYWR5IGluaXRpYWxpc2VkLgAAAAAKaW5pdGlhbGl6ZQAAAAAABAAAAAAAAAAGdGFyZ2V0AAAAAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAAC2JlbmVmaWNpYXJ5AAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADkNyb3dkZnVuZEVycm9yAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<Result<i128>>,
        claim: this.txFromJSON<Result<i128>>,
        get_status: this.txFromJSON<Array<u64>>,
        initialize: this.txFromJSON<Result<void>>
  }
}