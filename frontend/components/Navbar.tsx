"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/presale", label: "Presale" },
  { href: "/buy", label: "Buy" },
  { href: "/stake", label: "Stake" },
  { href: "/vault", label: "Vault" },
  { href: "/vesting", label: "Vesting" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-ditto-purple-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-ditto-teal/30 group-hover:ring-ditto-teal/60 transition-all">
            <Image
              src="/logo.png"
              alt="DittoCoin"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <span className="font-display text-xl font-bold text-white">
              Ditto<span className="text-ditto-teal">Coin</span>
            </span>
            <span className="ml-2 text-xs text-white/40">$DITTO</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-ditto-teal/15 text-ditto-teal"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Wallet Connect */}
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="address"
        />
      </div>
    </nav>
  );
}
