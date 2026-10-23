import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";

export default function NotFound() {
  return (
    <main className="kiluu-message">
      <LogoMark size={72} />
      <h1>Page not found</h1>
      <p>The page you’re looking for isn’t here.</p>
      <Link href="/">Back to Kiluu</Link>
    </main>
  );
}
