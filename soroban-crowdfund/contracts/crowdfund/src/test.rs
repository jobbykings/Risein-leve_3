#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn register_campaign(env: &Env) -> (Address, CrowdfundContractClient<'_>) {
    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(env, &contract_id);
    (contract_id, client)
}

/// Register a mintable Stellar Asset Contract for tests (the app uses the
/// native XLM SAC in production, but the contract is token-agnostic).
fn register_token(env: &Env) -> Address {
    let admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(admin).address()
}

/// Mint tokens to an address (test-only helper, uses the SAC admin).
fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

fn balance_of(env: &Env, token: &Address, addr: &Address) -> i128 {
    TokenClient::new(env, token).balance(addr)
}

/// A standard campaign: target 1_000 XLM, deadline in the future.
/// Returns (contract_id, client, beneficiary, token).
fn setup_campaign(env: &Env) -> (Address, CrowdfundContractClient<'_>, Address, Address) {
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let token = register_token(env);
    let (contract_id, client) = register_campaign(env);
    let beneficiary = Address::generate(env);
    let target = 1_000 * STROOPS_PER_XLM;
    client.initialize(&target, &5000u64, &beneficiary, &token);
    (contract_id, client, beneficiary, token)
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_sets_state() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let token = register_token(&env);
    let (_id, client) = register_campaign(&env);
    let beneficiary = Address::generate(&env);
    let target = 1_000 * STROOPS_PER_XLM;
    client.initialize(&target, &5000u64, &beneficiary, &token);

    let status = client.get_status();
    assert_eq!(status.get(0).unwrap(), 0); // total_raised
    assert_eq!(status.get(1).unwrap(), 1_000 * STROOPS_PER_XLM as u64); // target
    assert_eq!(status.get(2).unwrap(), 5000); // deadline
    assert_eq!(status.get(3).unwrap(), 0); // deadline_passed
    assert_eq!(status.get(4).unwrap(), 0); // is_claimed
}

#[test]
fn test_initialize_rejects_zero_target() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let token = register_token(&env);
    let (_id, client) = register_campaign(&env);
    let beneficiary = Address::generate(&env);
    assert_eq!(
        client.try_initialize(&0i128, &5000u64, &beneficiary, &token),
        Err(Ok(CrowdfundError::InvalidAmount))
    );
}

#[test]
fn test_double_initialize_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let token = register_token(&env);
    let (_id, client) = register_campaign(&env);
    let beneficiary = Address::generate(&env);
    let target = 1_000 * STROOPS_PER_XLM;
    client.initialize(&target, &5000u64, &beneficiary, &token);
    assert_eq!(
        client.try_initialize(&target, &6000u64, &beneficiary, &token),
        Err(Ok(CrowdfundError::AlreadyInitialized))
    );
}

// ---------------------------------------------------------------------------
// Funding (real token transfers via the configured SAC)
// ---------------------------------------------------------------------------

#[test]
fn test_fund_transfers_xlm_and_tracks_total() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, _beneficiary, token) = setup_campaign(&env);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 500 * STROOPS_PER_XLM);

    let contribution = 200 * STROOPS_PER_XLM;
    assert_eq!(client.fund(&donor, &contribution), contribution);

    // Tokens actually moved: contract balance == contribution, donor spent it.
    assert_eq!(balance_of(&env, &token, &contract_id), contribution);
    assert_eq!(
        balance_of(&env, &token, &donor),
        500 * STROOPS_PER_XLM - contribution
    );

    let status = client.get_status();
    assert_eq!(status.get(0).unwrap(), contribution as u64);
}

#[test]
fn test_fund_accumulates_multiple_contributors() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, _beneficiary, token) = setup_campaign(&env);

    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    mint(&env, &token, &donor1, 1_000 * STROOPS_PER_XLM);
    mint(&env, &token, &donor2, 1_000 * STROOPS_PER_XLM);

    let c1 = 300 * STROOPS_PER_XLM;
    let c2 = 400 * STROOPS_PER_XLM;
    assert_eq!(client.fund(&donor1, &c1), c1);
    assert_eq!(client.fund(&donor2, &c2), c1 + c2);

    assert_eq!(balance_of(&env, &token, &contract_id), c1 + c2);
    assert_eq!(client.get_status().get(0).unwrap(), (c1 + c2) as u64);
}

#[test]
fn test_fund_rejects_zero_or_negative_amount() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, _beneficiary, token) = setup_campaign(&env);
    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);

    assert_eq!(
        client.try_fund(&donor, &0i128),
        Err(Ok(CrowdfundError::InvalidAmount))
    );
    assert_eq!(
        client.try_fund(&donor, &(-10i128)),
        Err(Ok(CrowdfundError::InvalidAmount))
    );
    // No tokens should have moved.
    assert_eq!(balance_of(&env, &token, &contract_id), 0);
}

#[test]
fn test_fund_after_deadline_returns_error() {
    let env = Env::default();

    let (contract_id, client, _beneficiary, token) = setup_campaign(&env);
    // Advance past the deadline (set after setup_campaign, which resets time).
    env.ledger().set_timestamp(6000);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);

    assert_eq!(
        client.try_fund(&donor, &(100 * STROOPS_PER_XLM)),
        Err(Ok(CrowdfundError::DeadlinePassed))
    );
    assert_eq!(balance_of(&env, &token, &contract_id), 0);
}

#[test]
fn test_fund_before_initialize_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let token = register_token(&env);
    let (_id, client) = register_campaign(&env);
    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);

    assert_eq!(
        client.try_fund(&donor, &(100 * STROOPS_PER_XLM)),
        Err(Ok(CrowdfundError::NotInitialized))
    );
}

// ---------------------------------------------------------------------------
// Claim (beneficiary payout)
// ---------------------------------------------------------------------------

#[test]
fn test_claim_pays_beneficiary_when_target_met() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, beneficiary, token) = setup_campaign(&env);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);
    let contribution = 1_000 * STROOPS_PER_XLM;
    assert_eq!(client.fund(&donor, &contribution), contribution);

    // Advance past the deadline.
    env.ledger().set_timestamp(6000);

    let caller = Address::generate(&env);
    let payout = client.claim(&caller);
    assert_eq!(payout, contribution);

    // Funds moved to the beneficiary; the contract is drained.
    assert_eq!(balance_of(&env, &token, &beneficiary), contribution);
    assert_eq!(balance_of(&env, &token, &contract_id), 0);

    let status = client.get_status();
    assert_eq!(status.get(3).unwrap(), 1); // deadline_passed
    assert_eq!(status.get(4).unwrap(), 1); // is_claimed
}

#[test]
fn test_premature_claim_returns_error() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, beneficiary, token) = setup_campaign(&env);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);
    assert_eq!(
        client.fund(&donor, &(1_000 * STROOPS_PER_XLM)),
        1_000 * STROOPS_PER_XLM
    );

    // Still before the deadline.
    let caller = Address::generate(&env);
    assert_eq!(
        client.try_claim(&caller),
        Err(Ok(CrowdfundError::DeadlineNotPassed))
    );
    // Nothing was paid out.
    assert_eq!(balance_of(&env, &token, &beneficiary), 0);
    assert_eq!(
        balance_of(&env, &token, &contract_id),
        1_000 * STROOPS_PER_XLM
    );
}

#[test]
fn test_claim_when_target_not_met_returns_error() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, beneficiary, token) = setup_campaign(&env);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);
    // Only raise 300 XLM — below the 1_000 XLM target.
    assert_eq!(
        client.fund(&donor, &(300 * STROOPS_PER_XLM)),
        300 * STROOPS_PER_XLM
    );

    env.ledger().set_timestamp(6000);

    let caller = Address::generate(&env);
    assert_eq!(
        client.try_claim(&caller),
        Err(Ok(CrowdfundError::TargetNotMet))
    );
    assert_eq!(balance_of(&env, &token, &beneficiary), 0);
    assert_eq!(
        balance_of(&env, &token, &contract_id),
        300 * STROOPS_PER_XLM
    );
}

#[test]
fn test_double_claim_returns_error() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let (contract_id, client, beneficiary, token) = setup_campaign(&env);

    let donor = Address::generate(&env);
    mint(&env, &token, &donor, 1_000 * STROOPS_PER_XLM);
    assert_eq!(
        client.fund(&donor, &(1_000 * STROOPS_PER_XLM)),
        1_000 * STROOPS_PER_XLM
    );

    env.ledger().set_timestamp(6000);

    let caller = Address::generate(&env);
    assert_eq!(client.claim(&caller), 1_000 * STROOPS_PER_XLM);
    assert_eq!(
        client.try_claim(&caller),
        Err(Ok(CrowdfundError::AlreadyClaimed))
    );
    assert_eq!(
        balance_of(&env, &token, &beneficiary),
        1_000 * STROOPS_PER_XLM
    );
    assert_eq!(balance_of(&env, &token, &contract_id), 0);
}
