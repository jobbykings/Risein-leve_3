#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, symbol_short, token::TokenClient,
    Address, Env, Symbol, Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
const TARGET: Symbol = symbol_short!("TARGET");
const DEADLINE: Symbol = symbol_short!("DLINE");
const TOTAL_RAISED: Symbol = symbol_short!("TOTAL");
const CLAIMED: Symbol = symbol_short!("CLAIM");
const BENEFICIARY: Symbol = symbol_short!("BENEF");
const TOKEN: Symbol = symbol_short!("TOKEN");

/// Native XLM multiplier: 1 XLM = 10_000_000 stroops.
pub const STROOPS_PER_XLM: i128 = 10_000_000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// Typed contract errors returned instead of panicking.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum CrowdfundError {
    NotInitialized = 0,
    AlreadyInitialized = 1,
    DeadlinePassed = 2,
    DeadlineNotPassed = 3,
    TargetNotMet = 4,
    AlreadyClaimed = 5,
    InvalidAmount = 6,
    Overflow = 7,
    NoFunds = 8,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/// Emitted every time a contribution is made.
#[contractevent]
pub struct FundEvent {
    pub donor: Address,
    pub amount: i128,
    pub total_raised: i128,
    pub target: i128,
}

/// Emitted when the campaign funds are paid out to the beneficiary.
#[contractevent]
pub struct ClaimEvent {
    pub caller: Address,
    pub beneficiary: Address,
    pub amount: i128,
    pub total_raised: i128,
    pub target: i128,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct CrowdfundContract;

/// Returns a client for the campaign's configured token contract.
///
/// The token is the Stellar Asset Contract (SAC) for the currency the campaign
/// accepts — for this app it is the native XLM SAC, resolved by the deployer.
/// All transfers below are cross-contract calls to that token contract.
fn token_client(env: &Env) -> TokenClient<'_> {
    let token: Address = env
        .storage()
        .instance()
        .get(&TOKEN)
        .expect("campaign token not initialized");
    TokenClient::new(env, &token)
}

#[contractimpl]
impl CrowdfundContract {
    /// Initialise the crowdfund campaign with a funding `target` (in stroops),
    /// a Unix-second `deadline` (ledger timestamp), the `beneficiary` address
    /// that receives the raised funds on claim, and the `token` (SAC) address
    /// that the campaign accepts (native XLM for this app).
    ///
    /// Can only be called once — returns [`CrowdfundError::AlreadyInitialized`]
    /// if the campaign was already initialised.
    pub fn initialize(
        env: Env,
        target: i128,
        deadline: u64,
        beneficiary: Address,
        token: Address,
    ) -> Result<(), CrowdfundError> {
        if env.storage().instance().has(&TARGET) {
            return Err(CrowdfundError::AlreadyInitialized);
        }
        if target <= 0 {
            return Err(CrowdfundError::InvalidAmount);
        }
        env.storage().instance().set(&TARGET, &target);
        env.storage().instance().set(&DEADLINE, &deadline);
        env.storage().instance().set(&TOTAL_RAISED, &0i128);
        env.storage().instance().set(&CLAIMED, &false);
        env.storage().instance().set(&BENEFICIARY, &beneficiary);
        env.storage().instance().set(&TOKEN, &token);
        Ok(())
    }

    /// Contribute `amount` (stroops) to the campaign. Transfers real XLM from
    /// the `donor` to this contract via the configured Stellar Asset Contract
    /// (an inter-contract call). Returns the new total raised.
    ///
    /// Requires authorisation from `donor`.
    pub fn fund(env: Env, donor: Address, amount: i128) -> Result<i128, CrowdfundError> {
        donor.require_auth();

        let target: i128 = env
            .storage()
            .instance()
            .get(&TARGET)
            .ok_or(CrowdfundError::NotInitialized)?;
        let deadline: u64 = env
            .storage()
            .instance()
            .get(&DEADLINE)
            .ok_or(CrowdfundError::NotInitialized)?;

        if env.ledger().timestamp() > deadline {
            return Err(CrowdfundError::DeadlinePassed);
        }
        if amount <= 0 {
            return Err(CrowdfundError::InvalidAmount);
        }

        // Inter-contract call: move XLM from the donor into this contract.
        token_client(&env).transfer(&donor, env.current_contract_address(), &amount);

        let total_raised: i128 = env.storage().instance().get(&TOTAL_RAISED).unwrap_or(0);
        let new_total = total_raised
            .checked_add(amount)
            .ok_or(CrowdfundError::Overflow)?;
        env.storage().instance().set(&TOTAL_RAISED, &new_total);

        FundEvent {
            donor: donor.clone(),
            amount,
            total_raised: new_total,
            target,
        }
        .publish(&env);

        Ok(new_total)
    }

    /// Claim the raised funds once the deadline has passed **and** the target
    /// has been reached. Pays out the contract's entire token balance to the
    /// configured `beneficiary`. Any address may call this function (only one
    /// claim is allowed).
    pub fn claim(env: Env, caller: Address) -> Result<i128, CrowdfundError> {
        caller.require_auth();

        let target: i128 = env
            .storage()
            .instance()
            .get(&TARGET)
            .ok_or(CrowdfundError::NotInitialized)?;
        let deadline: u64 = env
            .storage()
            .instance()
            .get(&DEADLINE)
            .ok_or(CrowdfundError::NotInitialized)?;
        let total_raised: i128 = env.storage().instance().get(&TOTAL_RAISED).unwrap_or(0);
        let claimed: bool = env.storage().instance().get(&CLAIMED).unwrap_or(false);
        let beneficiary: Address = env
            .storage()
            .instance()
            .get(&BENEFICIARY)
            .ok_or(CrowdfundError::NotInitialized)?;
        let ledger_time: u64 = env.ledger().timestamp();

        if ledger_time <= deadline {
            return Err(CrowdfundError::DeadlineNotPassed);
        }
        if total_raised < target {
            return Err(CrowdfundError::TargetNotMet);
        }
        if claimed {
            return Err(CrowdfundError::AlreadyClaimed);
        }

        let token = token_client(&env);
        let balance = token.balance(&env.current_contract_address());
        if balance <= 0 {
            return Err(CrowdfundError::NoFunds);
        }

        // Inter-contract call: pay out the full balance to the beneficiary.
        token.transfer(&env.current_contract_address(), &beneficiary, &balance);

        env.storage().instance().set(&CLAIMED, &true);

        ClaimEvent {
            caller: caller.clone(),
            beneficiary: beneficiary.clone(),
            amount: balance,
            total_raised,
            target,
        }
        .publish(&env);

        Ok(balance)
    }

    /// Read the current campaign status.
    ///
    /// Returns a 5-element vector:
    ///   [0] total_raised (as u64)
    ///   [1] target       (as u64)
    ///   [2] deadline     (unix seconds)
    ///   [3] deadline_passed (1 = yes, 0 = no)
    ///   [4] is_claimed      (1 = yes, 0 = no)
    pub fn get_status(env: Env) -> Vec<u64> {
        let target: i128 = env.storage().instance().get(&TARGET).unwrap_or(0);
        let deadline: u64 = env.storage().instance().get(&DEADLINE).unwrap_or(0);
        let total_raised: i128 = env.storage().instance().get(&TOTAL_RAISED).unwrap_or(0);
        let claimed: bool = env.storage().instance().get(&CLAIMED).unwrap_or(false);
        let ledger_time: u64 = env.ledger().timestamp();

        let deadline_passed: u64 = if ledger_time > deadline { 1 } else { 0 };
        let is_claimed: u64 = if claimed { 1 } else { 0 };

        let mut res: Vec<u64> = Vec::new(&env);
        res.push_back(total_raised as u64);
        res.push_back(target as u64);
        res.push_back(deadline);
        res.push_back(deadline_passed);
        res.push_back(is_claimed);
        res
    }
}

mod test;
