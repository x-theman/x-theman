// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Fixed-supply ERC-20. The whole supply is minted once to `initialHolder`;
/// there is no owner and no way to mint more.
contract AirdropToken is ERC20, ERC20Burnable, ERC20Permit {
    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, address initialHolder)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        _mint(initialHolder, totalSupply_);
    }
}
