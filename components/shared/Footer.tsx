import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-4 text-center text-sm text-slate-500 md:flex-row md:justify-between md:gap-0">
          <p>&copy; {new Date().getFullYear()} flyhome.ai — All rights reserved.</p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <Link 
              href="/privacy" 
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/terms" 
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              href="/cookies" 
              className="hover:text-white transition-colors"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
