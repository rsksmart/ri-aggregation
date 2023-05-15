//! The network where the zkSync resides.
//!

// Built-in uses
use std::{fmt, str::FromStr};

// External uses
use serde::{Deserialize, Serialize};

// Workspace uses

// Local uses

/// Network to be used for a zkSync client.
///
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Network {
    /// RSK Mainnet.
    Mainnet,
    /// Ethereum Rinkeby testnet.
    Testnet,
    /// Self-hosted Ethereum & zkSync networks.
    Localhost,
    /// Unknown network type.
    Unknown,
    /// Test network for testkit purposes
    Test,
}

impl FromStr for Network {
    type Err = String;

    fn from_str(string: &str) -> Result<Self, Self::Err> {
        Ok(match string {
            "mainnet" => Self::Mainnet,
            "testnet" => Self::Testnet,
            "localhost" => Self::Localhost,
            "test" => Self::Test,
            another => return Err(another.to_owned()),
        })
    }
}

impl fmt::Display for Network {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Mainnet => write!(f, "mainnet"),
            Self::Testnet => write!(f, "testnet"),
            Self::Localhost => write!(f, "localhost"),
            Self::Unknown => write!(f, "unknown"),
            Self::Test => write!(f, "test"),
        }
    }
}

impl Network {
    /// Returns the network chain ID on the Ethereum side.
    pub fn chain_id(self) -> u8 {
        match self {
            Network::Mainnet => 30,
            Network::Testnet => 31,
            Network::Localhost => 33,
            Network::Unknown => panic!("Unknown chain ID"),
            Network::Test => panic!("Test chain ID"),
        }
    }
}
