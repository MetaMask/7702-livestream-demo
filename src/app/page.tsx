"use client";

import {
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import Image from "next/image";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  Hex,
  http,
  WalletClient,
  zeroAddress,
} from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as chain } from "viem/chains";

export default function Home() {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<Hex | null>(null);
  const [isAuthorizationLoading, setIsAuthorizationLoading] = useState(false);
  const [isBatchTransactionLoading, setIsBatchTransactionLoading] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const bundlerClient = createBundlerClient({
    chain,
    transport: http(process.env.NEXT_PUBLIC_PIMLICO_URL),
    paymaster: true,
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(process.env.NEXT_PUBLIC_PIMLICO_URL),
  });

  const handleCreateWallet = () => {
    try {
      setError(null);
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY;

      const wallet = createWalletClient({
        account: privateKeyToAccount(privateKey as `0x${string}`),
        chain,
        transport: http(),
      });

      setWalletClient(wallet);
      const address = wallet.account.address;
      console.log(address);
      setAddress(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    }
  };

  const handleSendAuthorization = async () => {
    if (!walletClient || !address) return;

    try {
      setIsAuthorizationLoading(true);
      setError(null);
      setTransactionHash(null);

      const authorization = await walletClient.signAuthorization({
        account: walletClient.account!,
        address: getSmartAccountsEnvironment(chain.id).implementations
          .EIP7702StatelessDeleGatorImpl,
        chainId: chain.id,
        executor: "self",
      });

      const transactionHash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        to: zeroAddress,
        account: walletClient.account!,
        chain: chain,
      });

      setTransactionHash(transactionHash);
      console.log(transactionHash);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send authorization"
      );
    } finally {
      setIsAuthorizationLoading(false);
    }
  };

  const handleSendBatchTransaction = async () => {
    if (!walletClient || !address) return;

    try {
      setIsBatchTransactionLoading(true);
      setError(null);
      setTransactionHash(null);

      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Stateless7702,
        address,
        signer: { account: walletClient.account! },
      });

      const { fast: fees } = await pimlicoClient.getUserOperationGasPrice();

      const userOperationHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: zeroAddress,
            value: BigInt(0),
            data: "0x",
          },
        ],
        ...fees,
      });

      const transactionReceipt =
        await bundlerClient.waitForUserOperationReceipt({
          hash: userOperationHash,
        });

      setTransactionHash(transactionReceipt.receipt.transactionHash);
      console.log(transactionReceipt.receipt.transactionHash);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send batch transaction"
      );
    } finally {
      setIsBatchTransactionLoading(false);
    }
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start max-w-2xl">
        <Image
          className=""
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />

        <div className="bg-gray-50 p-6 rounded-lg w-full">
          <h2 className="text-xl font-semibold mb-4">Wallet Creation</h2>

          <div className="mb-6">
            {address ? (
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Created to {address}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Not connected</span>
              </div>
            )}
          </div>

          <button
            className={`w-full rounded-lg border border-solid px-6 py-3 font-medium transition-colors ${
              address
                ? "bg-green-50 text-green-700 border-green-300 cursor-not-allowed"
                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 cursor-pointer"
            }`}
            onClick={handleCreateWallet}
            disabled={!!address}
          >
            {address ? "Wallet Connected" : "Create Wallet"}
          </button>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg w-full">
          <h2 className="text-xl font-semibold mb-4">EIP-7702 Authorization</h2>

          <div className="mb-4 text-sm text-gray-600">
            <p>
              Send authorization to enable EIP-7702 delegation functionality.
            </p>
          </div>

          <button
            className={`w-full rounded-lg border border-solid px-6 py-3 font-medium transition-colors mb-4 ${
              !address || isAuthorizationLoading
                ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 cursor-pointer"
            }`}
            onClick={handleSendAuthorization}
            disabled={!address || isAuthorizationLoading}
          >
            {isAuthorizationLoading ? "Sending Authorization..." : "Send Authorization"}
          </button>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg w-full">
          <h2 className="text-xl font-semibold mb-4">Send Batch Transaction</h2>

          <div className="mb-4 text-sm text-gray-600">
            <p>This will send a batch transaction using the smart account.</p>
          </div>

          <button
            className={`w-full rounded-lg border border-solid px-6 py-3 font-medium transition-colors mb-4 ${
              !address || isBatchTransactionLoading
                ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 cursor-pointer"
            }`}
            onClick={handleSendBatchTransaction}
            disabled={!address || isBatchTransactionLoading}
          >
            {isBatchTransactionLoading ? "Sending Transaction..." : "Send Batch Transaction"}
          </button>
        </div>

        {isAuthorizationLoading && (
          <div className="flex items-center gap-2 text-blue-600 mb-4">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Authorization pending...</span>
          </div>
        )}

        {isBatchTransactionLoading && (
          <div className="flex items-center gap-2 text-blue-600 mb-4">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Transaction pending...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="text-red-700 font-medium">Transaction Error</div>
            <div className="text-sm text-red-600 mt-1">{error}</div>
          </div>
        )}

        {transactionHash && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 w-full">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">
              Transaction Confirmed!
            </h2>
            <div className="text-sm">
              <p className="mb-2 text-blue-700">
                Your transaction has been successfully confirmed on the
                blockchain.
              </p>
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                View on Etherscan: {transactionHash}
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4 text-sm"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4 text-sm"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4 text-sm"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
