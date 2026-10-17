import { withAuth } from "@workos-inc/authkit-nextjs";
import { ThemingStudio } from "@/components/theming/ThemingStudio";

export const dynamic = "force-dynamic";

export default async function ThemingPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Theming</h1>
      <p className="mt-1 text-sm text-gray-600">
        Make your send form yours — presets, custom CSS, live preview.
      </p>
      <ThemingStudio />
    </main>
  );
}
