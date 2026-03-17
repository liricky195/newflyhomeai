"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NavScanCountdown from "./NavScanCountdown";

const authedLinks = [
	{ href: "/flights", label: "Flights" },
	{ href: "/bookings", label: "My Bookings" },
	{ href: "/plans", label: "Plans" },
	{ href: "/account", label: "Account" },
];

export default function Navbar() {
	const pathname = usePathname();
	const { data: session, status } = useSession();
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		setMobileOpen(false);
	}, [pathname]);

	const isActive = (href: string) => pathname === href;

	return (
		<nav className="sticky top-0 z-50 border-b border-border bg-navy/80 backdrop-blur-md">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
				{/* Wordmark */}
				<Link href="/" className="text-lg font-bold tracking-tight text-white">
					flyhome<span className="text-accent">.ai</span>
				</Link>

				{/* Desktop nav links */}
				{status === "authenticated" && (
					<div className="hidden items-center gap-6 md:flex">
						{authedLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={`relative text-sm transition-colors ${
									isActive(link.href)
										? "text-accent"
										: "text-slate-400 hover:text-white"
								}`}
							>
								{link.label}
								{isActive(link.href) && (
									<motion.span
										layoutId="nav-underline"
										className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-accent"
										transition={{ duration: 0.15 }}
									/>
								)}
							</Link>
						))}
					</div>
				)}

				<div className="md:block">
					<NavScanCountdown />
				</div>

				{/* Desktop right side */}
				<div className="hidden items-center gap-3 md:flex">
					{status === "authenticated" ? (
						<>
							{session?.user?.image ? (
								<Image
									src={session.user.image}
									alt=""
									width={28}
									height={28}
									className="rounded-full ring-1 ring-border"
								/>
							) : (
								<div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-700 text-xs font-medium text-slate-300 ring-1 ring-border">
									{session?.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
								</div>
							)}
							<Link
								href="/dashboard"
								className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
							>
								Dashboard
							</Link>
							<button
								onClick={() => signOut({ callbackUrl: "/" })}
								className="text-sm text-slate-400 transition-colors hover:text-white"
							>
								Sign Out
							</button>
						</>
					) : status === "unauthenticated" ? (
						<>
							<Link
								href="/auth"
								className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-accent-dark"
							>
								Sign In
							</Link>
						</>
					) : null}
				</div>

				{/* Mobile hamburger */}
				<button
					className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-white md:hidden"
					onClick={() => setMobileOpen((prev) => !prev)}
					aria-label="Toggle menu"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						{mobileOpen ? (
							<path d="M5 5l10 10M15 5L5 15" />
						) : (
							<path d="M3 6h14M3 10h14M3 14h14" />
						)}
					</svg>
				</button>
			</div>

			{/* Mobile menu */}
			<AnimatePresence>
				{mobileOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="overflow-hidden border-t border-border md:hidden"
					>
						<div className="flex flex-col gap-1 px-4 py-3">
							{status === "authenticated" && (
								<>
									<div className="mb-1 flex">
										<NavScanCountdown />
									</div>
									{authedLinks.map((link) => (
										<Link
											key={link.href}
											href={link.href}
											className={`rounded-md px-3 py-2 text-sm transition-colors ${
												isActive(link.href)
													? "bg-accent/10 text-accent"
													: "text-slate-400 hover:bg-navy-700 hover:text-white"
											}`}
										>
											{link.label}
										</Link>
									))}
									<Link
										href="/dashboard"
										className="rounded-md px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
									>
										Dashboard
									</Link>
									<button
										onClick={() => signOut({ callbackUrl: "/" })}
										className="rounded-md px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-navy-700 hover:text-white"
									>
										Sign Out
									</button>
								</>
							)}
							{status === "unauthenticated" && (
								<Link
									href="/auth"
									className="rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-navy"
								>
									Sign In
								</Link>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</nav>
	);
}
