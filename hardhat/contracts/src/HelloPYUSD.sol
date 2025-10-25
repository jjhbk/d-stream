// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import  "solmate/tokens/ERC721.sol";
import  "solmate/tokens/ERC20.sol";
import  "solmate/auth/Owned.sol";
import   "solmate/utils/SafeTransferLib.sol";
import  "./Renderer.sol";

contract HelloPYUSD is ERC721, Owned {
    uint256 public totalIssued;

    ERC20 public immutable mintToken;
    uint256 public immutable mintPrice;

    constructor(address _mintToken, uint256 _mintPrice) ERC721("HelloPYUSD", "HIPYUSD") Owned(msg.sender) {
        mintToken = ERC20(_mintToken);
        mintPrice = _mintPrice;
    }

    function mint() external {
        mintToken.transferFrom(msg.sender, address(this), mintPrice);
        _mint(msg.sender, ++totalIssued);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return Renderer.tokenURI(tokenId);
    }

    function withdrawToken(address token, address to) external onlyOwner {
        SafeTransferLib.safeTransfer(ERC20(token), to, ERC20(token).balanceOf(address(this)));
    }

    function withdraw(address to) external onlyOwner {
        SafeTransferLib.safeTransferETH(to, address(this).balance);
    }
}
