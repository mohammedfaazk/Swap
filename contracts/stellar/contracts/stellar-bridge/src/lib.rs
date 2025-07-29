#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct Bridge;

#[contractimpl]
impl Bridge {
    pub fn ping(env: Env) {
        env.events().publish((Symbol::new(&env, "pong"),), ());
    }
}
