#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, symbol_short, Address, Env, Symbol, Vec};

const TARGET: Symbol = symbol_short!("TARGET");
const DEADLINE: Symbol = symbol_short!("DLINE");
const TOTAL_RAISED: Symbol = symbol_short!("TOTAL");
const CLAIMED: Symbol = symbol_short!("CLAIM");

#[contractevent]
pub struct FundEvent {
    pub donor: Address,
    pub amount: u32,
    pub total_raised: u32,
    pub target: u32,
}

#[contractevent]
pub struct ClaimEvent {
    pub caller: Address,
    pub total_raised: u32,
    pub target: u32,
}

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    pub fn initialize(env: Env, target: u32, deadline: u64) {
        if env.storage().instance().has(&TARGET) {
            panic!("Campaign already initialized");
        }
        env.storage().instance().set(&TARGET, &target);
        env.storage().instance().set(&DEADLINE, &deadline);
        env.storage().instance().set(&TOTAL_RAISED, &0u32);
        env.storage().instance().set(&CLAIMED, &false);
    }

    pub fn fund(env: Env, donor: Address, amount: u32) -> u32 {
        donor.require_auth();

        let target: u32 = env.storage().instance().get(&TARGET).unwrap();
        let deadline: u64 = env.storage().instance().get(&DEADLINE).unwrap();
        let ledger_time: u64 = env.ledger().timestamp();

        if ledger_time > deadline {
            panic!("Campaign deadline has passed");
        }

        let mut total_raised: u32 = env.storage().instance().get(&TOTAL_RAISED).unwrap();
        let mut donor_balance: u32 = env.storage().persistent().get(&donor).unwrap_or(0);

        donor_balance += amount;
        total_raised += amount;

        env.storage().persistent().set(&donor, &donor_balance);
        env.storage().instance().set(&TOTAL_RAISED, &total_raised);

        FundEvent {
            donor: donor.clone(),
            amount,
            total_raised,
            target,
        }
        .publish(&env);

        total_raised
    }

    pub fn claim(env: Env, caller: Address) -> u32 {
        caller.require_auth();

        let target: u32 = env.storage().instance().get(&TARGET).unwrap();
        let deadline: u64 = env.storage().instance().get(&DEADLINE).unwrap();
        let total_raised: u32 = env.storage().instance().get(&TOTAL_RAISED).unwrap();
        let claimed: bool = env.storage().instance().get(&CLAIMED).unwrap_or(false);
        let ledger_time: u64 = env.ledger().timestamp();

        if ledger_time <= deadline {
            panic!("Campaign deadline has not yet passed");
        }

        if total_raised < target {
            panic!("Target goal was not reached");
        }

        if claimed {
            panic!("Funds have already been claimed");
        }

        env.storage().instance().set(&CLAIMED, &true);

        ClaimEvent {
            caller: caller.clone(),
            total_raised,
            target,
        }
        .publish(&env);

        total_raised
    }

    pub fn get_status(env: Env) -> Vec<u64> {
        let target: u32 = env.storage().instance().get(&TARGET).unwrap_or(0);
        let deadline: u64 = env.storage().instance().get(&DEADLINE).unwrap_or(0);
        let total_raised: u32 = env.storage().instance().get(&TOTAL_RAISED).unwrap_or(0);
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
