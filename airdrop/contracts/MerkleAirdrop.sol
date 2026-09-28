// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Merkle-proof airdrop distributor. Leaves use OpenZeppelin's
/// StandardMerkleTree encoding: keccak256(bytes.concat(keccak256(abi.encode(account, amount)))).
contract MerkleAirdrop is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    uint256 public immutable claimDeadline;

    mapping(address => bool) public isClaimed;

    event Claimed(address indexed account, uint256 amount);

    error AlreadyClaimed();
    error InvalidProof();
    error ClaimWindowClosed();
    error ClaimWindowOpen();

    constructor(IERC20 _token, bytes32 _merkleRoot, uint256 _claimDeadline) Ownable(msg.sender) {
        token = _token;
        merkleRoot = _merkleRoot;
        claimDeadline = _claimDeadline;
    }

    /// @notice Anyone may submit, but tokens always go to `account`.
    function claim(address account, uint256 amount, bytes32[] calldata proof) external {
        if (block.timestamp > claimDeadline) revert ClaimWindowClosed();
        if (isClaimed[account]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        isClaimed[account] = true;
        token.safeTransfer(account, amount);
        emit Claimed(account, amount);
    }

    /// @notice Return unclaimed tokens to the owner once the window closes.
    function sweep(address to) external onlyOwner {
        if (block.timestamp <= claimDeadline) revert ClaimWindowOpen();
        token.safeTransfer(to, token.balanceOf(address(this)));
    }
}
