import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

export default function NotFound() {
  const notFoundContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-white">
      <div className="relative flex items-center justify-center w-full max-w-5xl max-h-screen">
        <img
          src="/CodePen-404-Page.gif"
          alt="404 Not Found"
          className="w-full h-auto max-h-screen object-contain"
        />
        {/* Overlay the real button perfectly over the GIF's fake button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Link to="/" className="pointer-events-auto absolute" style={{ bottom: '15.5%' }}>
            <Button className="h-12 px-8 text-base font-bold shadow-xl rounded-md w-[200px] flex items-center justify-center">
              <Home size={20} className="mr-2" />
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(notFoundContent, document.body);
}
