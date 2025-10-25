import { ethers } from "hardhat";
async function main() {
  const MyContract = await ethers.getContractFactory("HelloPYUSD");
  const myContract = await MyContract.deploy();
  await myContract.waitForDeployment();

  console.log("Deployed to:", await myContract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
