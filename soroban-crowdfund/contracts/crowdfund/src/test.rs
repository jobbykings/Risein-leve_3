#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    IntoVal,
};

#[test]
fn test_contribution_tracking() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&1000u32, &5000u64);

    let donor = Address::generate(&env);

    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor.clone(), 200u32).into_val(&env),
        sub_invokes: &[],
    };
    let raised = client
        .mock_auths(&[MockAuth { address: &donor, invoke: &invoke }])
        .fund(&donor, &200u32);
    assert_eq!(raised, 200);

    let donor2 = Address::generate(&env);
    let invoke2 = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor2.clone(), 300u32).into_val(&env),
        sub_invokes: &[],
    };
    let raised = client
        .mock_auths(&[MockAuth { address: &donor2, invoke: &invoke2 }])
        .fund(&donor2, &300u32);
    assert_eq!(raised, 500);

    let status = client.get_status();
    assert_eq!(status.get(0).unwrap(), 500);
    assert_eq!(status.get(1).unwrap(), 1000);
    assert_eq!(status.get(2).unwrap(), 0);
    assert_eq!(status.get(3).unwrap(), 0);
}

#[test]
fn test_claim_after_target_met_and_deadline_passed() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&500u32, &2000u64);

    let donor = Address::generate(&env);
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor.clone(), 500u32).into_val(&env),
        sub_invokes: &[],
    };
    let raised = client
        .mock_auths(&[MockAuth { address: &donor, invoke: &invoke }])
        .fund(&donor, &500u32);
    assert_eq!(raised, 500);

    env.ledger().set_timestamp(3000);

    let caller = Address::generate(&env);
    let claim_invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "claim",
        args: (caller.clone(),).into_val(&env),
        sub_invokes: &[],
    };
    let claimed = client
        .mock_auths(&[MockAuth { address: &caller, invoke: &claim_invoke }])
        .claim(&caller);
    assert_eq!(claimed, 500);

    let status = client.get_status();
    assert_eq!(status.get(3).unwrap(), 1);
}

#[test]
#[should_panic(expected = "Campaign deadline has not yet passed")]
fn test_premature_claim_before_deadline_panics() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&500u32, &2000u64);

    let donor = Address::generate(&env);
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor.clone(), 500u32).into_val(&env),
        sub_invokes: &[],
    };
    client
        .mock_auths(&[MockAuth { address: &donor, invoke: &invoke }])
        .fund(&donor, &500u32);

    let caller = Address::generate(&env);
    let claim_invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "claim",
        args: (caller.clone(),).into_val(&env),
        sub_invokes: &[],
    };
    client
        .mock_auths(&[MockAuth { address: &caller, invoke: &claim_invoke }])
        .claim(&caller);
}

#[test]
#[should_panic(expected = "Funds have already been claimed")]
fn test_double_claim_panics() {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&500u32, &2000u64);

    let donor = Address::generate(&env);
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor.clone(), 500u32).into_val(&env),
        sub_invokes: &[],
    };
    client
        .mock_auths(&[MockAuth { address: &donor, invoke: &invoke }])
        .fund(&donor, &500u32);

    env.ledger().set_timestamp(3000);

    let caller = Address::generate(&env);
    let claim_invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "claim",
        args: (caller.clone(),).into_val(&env),
        sub_invokes: &[],
    };
    client
        .mock_auths(&[MockAuth { address: &caller, invoke: &claim_invoke }])
        .claim(&caller);

    client
        .mock_auths(&[MockAuth { address: &caller, invoke: &claim_invoke }])
        .claim(&caller);
}

#[test]
#[should_panic(expected = "Campaign deadline has passed")]
fn test_fund_after_deadline_panics() {
    let env = Env::default();
    env.ledger().set_timestamp(5000);

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&1000u32, &3000u64);

    let donor = Address::generate(&env);
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "fund",
        args: (donor.clone(), 100u32).into_val(&env),
        sub_invokes: &[],
    };
    client
        .mock_auths(&[MockAuth { address: &donor, invoke: &invoke }])
        .fund(&donor, &100u32);
}
