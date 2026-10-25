import logo from "@/assets/logo.png";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="liquid-bg relative min-h-screen overflow-hidden text-foreground">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between rounded-full glass px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <img src={logo} alt="Mr Frank Cloud Config logo" width={28} height={28} className="h-7 w-7" />
            <span>
            Mr Frank<span className="text-primary"> Cloud Config</span></span>
          </Link>
          <span className="text-xs text-muted-foreground">.hc sharing</span>
        </nav>
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mb-6 mt-16 w-[calc(100%-2rem)] max-w-5xl rounded-3xl glass px-6 py-8 text-center">
      <img src={logo} alt="" width={48} height={48} loading="lazy" className="mx-auto mb-3 h-12 w-12" />
      <p className="font-display text-2xl font-semibold tracking-tight">
        Made by <span className="shimmer-text">Mr Frank</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Upload. Share. Expire on your terms.</p>
      <p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} Mr Frank Cloud Config · cloudvpn.mrfrankofc.com</p>
    </footer>
  );
}
