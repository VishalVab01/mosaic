"use client";

import { CreditCard, LogOut, Settings, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  if (!session?.user) {
    return null;
  }

  const userName = session.user.name ?? "User";
  const userEmail = session.user.email ?? "";
  const userImage = session.user.image;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open user menu"
        className="user-menu-trigger"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {userImage ? (
          <img alt={userName} src={userImage} />
        ) : (
          <User size={20} />
        )}
      </button>

      {isOpen && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <strong>{userName}</strong>
            {userEmail && <span>{userEmail}</span>}
          </div>

          <Link href="/profile" onClick={() => setIsOpen(false)} role="menuitem">
            <User size={16} />
            Profile
          </Link>
          <Link href="/profile/settings" onClick={() => setIsOpen(false)} role="menuitem">
            <Settings size={16} />
            Profile settings
          </Link>
          <Link href="/payments" onClick={() => setIsOpen(false)} role="menuitem">
            <CreditCard size={16} />
            Payments
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/" })} role="menuitem" type="button">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
