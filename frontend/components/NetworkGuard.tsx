"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

/**
 * Wraps page content and shows a warning banner if the user is
 * on an unsupported chain. Offers one-click switch to mainnet or sepolia.
 */
export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const supportedIds: number[] = [mainnet.id, sepolia.id];
  const isWrongNetwork = isConnected && chain && !supportedIds.includes(chain.id);

  if (!isWrongNetwork) return <>{children}</>;

  return (
    <>
      <div className="bg-ditto-amber/10 border-b border-ditto-amber/20 px-6 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-4">
          <p className="text-ditto-amber text-sm font-medium">
            You&apos;re connected to an unsupported network ({chain?.name || "Unknown"}).
            Switch to Ethereum Mainnet or Sepolia.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => switchChain({ chainId: mainnet.id })}
              className="px-3 py-1.5 rounded-lg bg-ditto-amber/20 text-ditto-amber text-xs font-bold hover:bg-ditto-amber/30 transition-colors"
            >
              Mainnet
            </button>
            <button
              onClick={() => switchChain({ chainId: sepolia.id })}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Sepolia
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
