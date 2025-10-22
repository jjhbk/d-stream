import { useNotification } from "@blockscout/app-sdk";

const Txn = () => {
  const { openTxToast } = useNotification();

  const handleTransaction = async (txHash: any) => {
    try {
      // Your transaction logic here
      //await sendTransaction();

      // Show transaction toast
      openTxToast("1", txHash); // '1' is the chain ID for Ethereum mainnet
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  return (
    <button onClick={() => handleTransaction("0x123...")}>
      Send Transaction
    </button>
  );
};
export default Txn;
