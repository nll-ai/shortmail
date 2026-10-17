import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">ShortMail</h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        Short, thoughtful messages — max 500 characters. The new
        Vercel&nbsp;+&nbsp;Convex stack (test deployment).
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-full bg-black text-white px-6 py-2 hover:opacity-80"
        >
          Sign in
        </Link>
        <Link
          href="/send/demo"
          className="rounded-full border border-black px-6 py-2 hover:bg-gray-50"
        >
          Demo form
        </Link>
      </div>
    </main>
  );
}
